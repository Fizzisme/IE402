import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('danger_zones')
export class DangerZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200, nullable: true })
  name: string;

  @Column({ default: 1 })
  danger_level: number;

  @Column({ length: 50 })
  event_type: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, default: 'manual' })
  data_source: string;

  @Column({ length: 100, nullable: true })
  source_event_id: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  valid_from: Date;

  @Column({ type: 'timestamptz', nullable: true })
  valid_until: Date;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  created_by: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
