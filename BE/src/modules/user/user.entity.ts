import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, unique: true, nullable: true })
  phone: string;

  @Column({ length: 150, unique: true, nullable: true })
  email: string;

  @Column({ length: 255, nullable: true })
  password_hash: string;

  @Column({ length: 20, default: 'user' })
  role: string;

  @Column({ length: 255, nullable: true })
  fcm_token: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
