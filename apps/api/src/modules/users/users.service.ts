import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

interface CreateUserInput {
  displayName: string;
  defaultCurrencyCode?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>
  ) {}

  async createUser(input: CreateUserInput): Promise<UserEntity> {
    const user = this.users.create({
      displayName: input.displayName,
      defaultCurrencyCode: input.defaultCurrencyCode ?? 'INR',
      state: 'active'
    });
    return this.users.save(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async updateDisplayName(user: UserEntity, displayName: string): Promise<UserEntity> {
    user.displayName = displayName;
    return this.users.save(user);
  }
}
