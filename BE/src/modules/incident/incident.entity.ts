import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 20, default: 'medium' })
  severity: string;

  @Column({ nullable: true })
  reported_by: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reported_by' })
  reporter: User;

  @CreateDateColumn({ type: 'timestamptz' })
  reported_at: Date;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date;

  @Column({ type: 'float', default: 50 })
  affected_radius_m: number;

  @Column({ length: 500, nullable: true })
  image_url: string;
}
