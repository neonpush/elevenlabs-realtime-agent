import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config';

// Lead attributes interface
interface LeadAttributes {
  id: number;
  phone_number: string;
  external_lead_id?: string;
  name?: string;
  move_in_date?: Date;
  budget?: number;
  yearly_wage?: string;
  occupation?: string;
  contract_length?: number;
  email?: string;
  preferred_time?: string;
  property_type?: string;
  area?: string;
  availability?: string[];
  // Property details
  address_line_1?: string;
  postcode?: string;
  bedroom_count?: number;
  availability_at?: Date;
  property_cost?: number;
  completeness_level: 'COMPLETE' | 'PARTIAL' | 'MINIMAL';
  source?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  call_sid?: string;
  call_started_at?: Date;
  completed_at?: Date;
  call_outcome?: string;
  created_at: Date;
  updated_at: Date;
}

// Attributes required for creation
interface LeadCreationAttributes extends Optional<LeadAttributes, 'id' | 'created_at' | 'updated_at'> {}

// Lead model class
export class Lead extends Model<LeadAttributes, LeadCreationAttributes> implements LeadAttributes {
  public id!: number;
  public phone_number!: string;
  public external_lead_id?: string;
  public name?: string;
  public move_in_date?: Date;
  public budget?: number;
  public yearly_wage?: string;
  public occupation?: string;
  public contract_length?: number;
  public email?: string;
  public preferred_time?: string;
  public property_type?: string;
  public area?: string;
  public availability?: string[];
  // Property details
  public address_line_1?: string;
  public postcode?: string;
  public bedroom_count?: number;
  public availability_at?: Date;
  public property_cost?: number;
  public completeness_level!: 'COMPLETE' | 'PARTIAL' | 'MINIMAL';
  public source?: string;
  public status!: 'pending' | 'in_progress' | 'completed' | 'failed';
  public call_sid?: string;
  public call_started_at?: Date;
  public completed_at?: Date;
  public call_outcome?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Lead.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    external_lead_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    move_in_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    budget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    yearly_wage: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Range format: "20k-30k", "30k-40k", etc.'
    },
    occupation: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [['employed', 'student']]
      }
    },
    contract_length: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Contract length in months'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    preferred_time: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    property_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    area: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    availability: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      defaultValue: []
    },
    // Property details
    address_line_1: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Property address line 1'
    },
    postcode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Property postcode'
    },
    bedroom_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Number of bedrooms in the property'
    },
    availability_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date when property becomes available'
    },
    property_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Monthly cost of the property'
    },
    completeness_level: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['COMPLETE', 'PARTIAL', 'MINIMAL']]
      }
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'in_progress', 'completed', 'failed']]
      }
    },
    call_sid: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    call_started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    call_outcome: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'Lead',
    tableName: 'leads',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['phone_number'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      { fields: ['external_lead_id'] }
    ]
  }
);

export default Lead; 