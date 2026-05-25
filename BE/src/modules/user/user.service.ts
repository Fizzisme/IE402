import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password_hash: dto.password_hash,
      role: dto.role ?? 'user',
      is_active: true,
    });
    return this.userRepository.save(user);
  }

  async updateLocation(userId: string, lat: number, lng: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE users SET last_known_location = ST_SetSRID(ST_MakePoint($1, $2), 4326), updated_at = NOW() WHERE id = $3`,
      [lng, lat, userId],
    );
  }

  async getProfile(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, name, phone, email, role, fcm_token, is_active, created_at, updated_at,
              ST_X(last_known_location) AS lng,
              ST_Y(last_known_location) AS lat
       FROM users WHERE id = $1`,
      [userId],
    );
    if (!rows.length) {
      throw new NotFoundException('User not found');
    }
    return rows[0];
  }
}
