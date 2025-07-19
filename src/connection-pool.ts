import WebSocket from 'ws';

interface PooledConnection {
  ws: WebSocket;
  createdAt: number;
  callSid?: string;
  isReady: boolean;
  lastUsed: number;
}

export class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: Map<string, PooledConnection> = new Map();
  private hotConnections: PooledConnection[] = []; // Pre-warmed ready connections
  private readonly MAX_IDLE_TIME = 300000; // 5 minutes
  private readonly HOT_POOL_SIZE = 3; // Keep 3 hot connections ready
  private readonly MAX_CONNECTION_AGE = 1800000; // 30 minutes max age
  
  private constructor() {
    // Pre-warm hot connections immediately
    this.preWarmHotPool();
    
    // Cleanup and maintain pools every 10 seconds
    setInterval(() => {
      this.cleanupIdleConnections();
      this.maintainHotPool();
    }, 10000);
    
    // Refresh hot pool every 15 minutes to prevent stale connections
    setInterval(() => this.refreshHotPool(), 900000);
  }
  
  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  async getOrCreateConnection(callSid: string): Promise<WebSocket | null> {
    // Check if we already have a connection for this call
    const existing = this.connections.get(callSid);
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      console.log(`♻️  Reusing pre-warmed connection for ${callSid}`);
      existing.lastUsed = Date.now();
      return existing.ws;
    }
    
    // Try to get a hot connection first (FASTEST)
    const hotConnection = this.getHotConnection();
    if (hotConnection) {
      console.log(`🔥 Using hot connection for ${callSid} (0ms setup time!)`);
      hotConnection.callSid = callSid;
      hotConnection.lastUsed = Date.now();
      this.connections.set(callSid, hotConnection);
      
      // Immediately start warming a replacement
      this.createHotConnection();
      
      return hotConnection.ws;
    }
    
    // Fallback: Create new connection (slower)
    console.log(`🔌 Creating new connection for ${callSid}...`);
    return this.createNewConnection(callSid);
  }

  private getHotConnection(): PooledConnection | null {
    // Find the oldest ready hot connection
    const available = this.hotConnections.filter(conn => 
      conn.isReady && 
      conn.ws.readyState === WebSocket.OPEN &&
      !conn.callSid
    );
    
    if (available.length > 0) {
      const connection = available[0];
      // Remove from hot pool
      this.hotConnections = this.hotConnections.filter(c => c !== connection);
      return connection;
    }
    
    return null;
  }

  private async preWarmHotPool(): Promise<void> {
    console.log(`🔥 Pre-warming ${this.HOT_POOL_SIZE} hot connections...`);
    
    const promises = Array(this.HOT_POOL_SIZE).fill(null).map(() => 
      this.createHotConnection()
    );
    
    await Promise.all(promises);
    console.log(`✅ Hot pool ready with ${this.hotConnections.length} connections`);
  }

  private async maintainHotPool(): Promise<void> {
    const activeHot = this.hotConnections.filter(conn => 
      conn.ws.readyState === WebSocket.OPEN && conn.isReady
    );
    
    const needed = this.HOT_POOL_SIZE - activeHot.length;
    
    if (needed > 0) {
      console.log(`🔥 Warming ${needed} additional hot connections...`);
      for (let i = 0; i < needed; i++) {
        this.createHotConnection();
      }
    }
  }

  private async refreshHotPool(): Promise<void> {
    console.log('🔄 Refreshing hot connection pool...');
    
    // Close old hot connections
    this.hotConnections.forEach(conn => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
      }
    });
    
    this.hotConnections = [];
    
    // Create fresh hot pool
    await this.preWarmHotPool();
  }

  private async createHotConnection(): Promise<void> {
    try {
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      const apiKey = process.env.ELEVENLABS_API_KEY;
      
      if (!agentId || !apiKey) {
        console.error('❌ Missing ElevenLabs credentials for hot connection');
        return;
      }

      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}&output_format=ulaw_8000`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      const connection: PooledConnection = {
        ws,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isReady: false
      };

      ws.on('open', () => {
        connection.isReady = true;
        
        // Send conversation initiation immediately
        ws.send(JSON.stringify({
          type: 'conversation_initiation_client_data'
        }));
        
        console.log('🔥 Hot connection ready');
      });

      ws.on('error', (error) => {
        console.error('❌ Hot connection error:', error);
        this.removeHotConnection(connection);
      });

      ws.on('close', () => {
        this.removeHotConnection(connection);
      });

      this.hotConnections.push(connection);
      
    } catch (error) {
      console.error('❌ Failed to create hot connection:', error);
    }
  }

  private removeHotConnection(connection: PooledConnection): void {
    this.hotConnections = this.hotConnections.filter(c => c !== connection);
  }

  private async createNewConnection(callSid: string): Promise<WebSocket | null> {
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!agentId || !apiKey) {
      console.error('❌ Missing ELEVENLABS_AGENT_ID or ELEVENLABS_API_KEY');
      return null;
    }
    
    const ws = new WebSocket(
      `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}&output_format=ulaw_8000`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return new Promise((resolve) => {
      ws.on('open', () => {
        const connection: PooledConnection = {
          ws,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          callSid,
          isReady: true
        };
        
        this.connections.set(callSid, connection);
        console.log(`✅ Pre-connected to ElevenLabs for ${callSid}`);
        resolve(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ Connection error:', error);
        resolve(null);
      });
    });
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    
    // Clean up assigned connections
    for (const [callSid, connection] of this.connections.entries()) {
      const isStale = (now - connection.lastUsed) > this.MAX_IDLE_TIME;
      const isOld = (now - connection.createdAt) > this.MAX_CONNECTION_AGE;
      const isDead = connection.ws.readyState !== WebSocket.OPEN;
      
      if (isStale || isOld || isDead) {
        console.log(`🧹 Cleaning up connection for ${callSid}`);
        
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
        
        this.connections.delete(callSid);
      }
    }
    
    // Clean up hot connections
    this.hotConnections = this.hotConnections.filter(connection => {
      const isOld = (now - connection.createdAt) > this.MAX_CONNECTION_AGE;
      const isDead = connection.ws.readyState !== WebSocket.OPEN;
      
      if (isOld || isDead) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
        return false;
      }
      return true;
    });
    
    console.log(`📊 Active connections: ${this.connections.size}, Hot pool: ${this.hotConnections.length}`);
  }

  removeConnection(callSid: string): void {
    const connection = this.connections.get(callSid);
    if (connection) {
      connection.ws.close();
      this.connections.delete(callSid);
    }
  }

  markAsActive(callSid: string): void {
    const connection = this.connections.get(callSid);
    if (connection) {
      // Remove from pool so it won't be cleaned up
      this.connections.delete(callSid);
    }
  }

  releaseConnection(callSid: string): void {
    const connection = this.connections.get(callSid);
    if (connection) {
      console.log(`🧹 Cleaning up connection for ${callSid}`);
      
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
      
      this.connections.delete(callSid);
    }
  }

  getStats(): { active: number; hot: number } {
    return {
      active: this.connections.size,
      hot: this.hotConnections.length
    };
  }
} 