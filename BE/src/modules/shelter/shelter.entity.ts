import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('shelters')
export class Shelter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ default: 0 })
  capacity: number;

  @Column({ default: 0 })
  current_occupancy: number;

  @Column({ length: 20, default: 'available' })
  status: string;

  @Column({ length: 50, nullable: true })
  type: string;

  @Column({ length: 20, nullable: true })
  contact_phone: string;

  @Column({ default: false })
  has_medical: boolean;

  @Column({ default: false })
  has_food: boolean;

  @Column({ default: false })
  has_water: boolean;

  @Column({ length: 500, nullable: true })
  image_url: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
