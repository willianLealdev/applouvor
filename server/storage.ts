import {
  users,
  songs,
  services,
  serviceSongs,
  type User,
  type InsertUser,
  type Song,
  type InsertSong,
  type Service,
  type InsertService,
  type ServiceSong,
  type InsertServiceSong,
  type ServiceWithSongs,
  type ServiceSongWithDetails,
  type UserRole,
  type UserStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithPassword(data: { name: string; email: string; role: UserRole; passwordHash: string; status: UserStatus }): Promise<User>;
  createUserWithProvisionalPassword(data: { name: string; email: string; role: UserRole; passwordHash: string }): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  updateUserPasswordAndClearFlag(id: string, passwordHash: string): Promise<User | undefined>;
  updateUserStatus(id: string, status: UserStatus): Promise<User | undefined>;
  updateUserInvitation(id: string, token: string, expires: Date): Promise<User | undefined>;
  getUserByInvitationToken(token: string): Promise<User | undefined>;
  activateUser(id: string, passwordHash: string, name: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  setPasswordResetToken(id: string, token: string, expires: Date): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  resetPasswordWithToken(id: string, passwordHash: string): Promise<User | undefined>;

  getSong(id: string): Promise<Song | undefined>;
  getSongs(): Promise<Song[]>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, data: { content?: string; originalKey?: string }): Promise<Song | undefined>;
  deleteSong(id: string): Promise<void>;

  getService(id: string): Promise<Service | undefined>;
  getServiceWithSongs(id: string): Promise<ServiceWithSongs | undefined>;
  getServices(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, data: { name?: string; date?: string; time?: string }): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;

  addSongToService(serviceSong: InsertServiceSong): Promise<ServiceSong>;
  removeSongFromService(id: string): Promise<void>;
  updateServiceSongKey(id: string, transposedKey: string): Promise<ServiceSong>;
  updateServiceSongOrder(id: string, order: number): Promise<ServiceSong>;
  reorderServiceSongs(serviceId: string, songOrders: { id: string; order: number }[]): Promise<void>;
  getServiceSongs(serviceId: string): Promise<ServiceSongWithDetails[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      name: insertUser.name,
      email: insertUser.email,
      role: (insertUser.role || "membro") as UserRole,
    }).returning();
    return user;
  }

  async createUserWithPassword(data: { name: string; email: string; role: UserRole; passwordHash: string; status: UserStatus }): Promise<User> {
    const [user] = await db.insert(users).values({
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash: data.passwordHash,
      status: data.status,
    }).returning();
    return user;
  }

  async createUserWithProvisionalPassword(data: { name: string; email: string; role: UserRole; passwordHash: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      name: data.name,
      email: data.email,
      role: data.role,
      passwordHash: data.passwordHash,
      status: "active" as UserStatus,
      mustChangePassword: true,
    }).returning();
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ passwordHash, status: "active" as UserStatus }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserPasswordAndClearFlag(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ 
      passwordHash, 
      mustChangePassword: false 
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<User | undefined> {
    const [user] = await db.update(users).set({ 
      passwordResetToken: token, 
      passwordResetExpires: expires 
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user || undefined;
  }

  async resetPasswordWithToken(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ 
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      mustChangePassword: false,
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<User | undefined> {
    const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserInvitation(id: string, token: string, expires: Date): Promise<User | undefined> {
    const [user] = await db.update(users).set({ 
      invitationToken: token, 
      invitationExpires: expires 
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getUserByInvitationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.invitationToken, token));
    return user || undefined;
  }

  async activateUser(id: string, passwordHash: string, name: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ 
      passwordHash, 
      name,
      status: "active" as UserStatus,
      invitationToken: null,
      invitationExpires: null,
    }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getSong(id: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    return song || undefined;
  }

  async getSongs(): Promise<Song[]> {
    return await db.select().from(songs);
  }

  async createSong(insertSong: InsertSong): Promise<Song> {
    const [song] = await db.insert(songs).values(insertSong).returning();
    return song;
  }

  async updateSong(id: string, data: { content?: string; originalKey?: string }): Promise<Song | undefined> {
    const updateData: Partial<InsertSong> = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.originalKey !== undefined) updateData.originalKey = data.originalKey;
    
    if (Object.keys(updateData).length === 0) {
      return this.getSong(id);
    }
    
    const [song] = await db.update(songs).set(updateData).where(eq(songs.id, id)).returning();
    return song;
  }

  async deleteSong(id: string): Promise<void> {
    await db.delete(serviceSongs).where(eq(serviceSongs.songId, id));
    await db.delete(songs).where(eq(songs.id, id));
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async getServiceWithSongs(id: string): Promise<ServiceWithSongs | undefined> {
    const service = await this.getService(id);
    if (!service) return undefined;

    const serviceSongsList = await this.getServiceSongs(id);

    return {
      ...service,
      songs: serviceSongsList,
    };
  }

  async getServices(): Promise<Service[]> {
    return await db.select().from(services).orderBy(desc(services.date));
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(insertService).returning();
    return service;
  }

  async updateService(id: string, data: { name?: string; date?: string; time?: string }): Promise<Service | undefined> {
    const updateData: Partial<{ name: string; date: string; time: string }> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.time !== undefined) updateData.time = data.time;

    const [service] = await db
      .update(services)
      .set(updateData)
      .where(eq(services.id, id))
      .returning();
    return service || undefined;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(serviceSongs).where(eq(serviceSongs.serviceId, id));
    await db.delete(services).where(eq(services.id, id));
  }

  async addSongToService(insertServiceSong: InsertServiceSong): Promise<ServiceSong> {
    const existingSongs = await db
      .select()
      .from(serviceSongs)
      .where(eq(serviceSongs.serviceId, insertServiceSong.serviceId));

    const order = existingSongs.length + 1;

    const [serviceSong] = await db
      .insert(serviceSongs)
      .values({ ...insertServiceSong, order })
      .returning();
    return serviceSong;
  }

  async removeSongFromService(id: string): Promise<void> {
    await db.delete(serviceSongs).where(eq(serviceSongs.id, id));
  }

  async updateServiceSongKey(id: string, transposedKey: string): Promise<ServiceSong> {
    const [serviceSong] = await db
      .update(serviceSongs)
      .set({ transposedKey })
      .where(eq(serviceSongs.id, id))
      .returning();
    return serviceSong;
  }

  async updateServiceSongOrder(id: string, order: number): Promise<ServiceSong> {
    const [serviceSong] = await db
      .update(serviceSongs)
      .set({ order })
      .where(eq(serviceSongs.id, id))
      .returning();
    return serviceSong;
  }

  async reorderServiceSongs(serviceId: string, songOrders: { id: string; order: number }[]): Promise<void> {
    for (const { id, order } of songOrders) {
      await db
        .update(serviceSongs)
        .set({ order })
        .where(eq(serviceSongs.id, id));
    }
  }

  async getServiceSongs(serviceId: string): Promise<ServiceSongWithDetails[]> {
    const serviceSongsList = await db
      .select()
      .from(serviceSongs)
      .where(eq(serviceSongs.serviceId, serviceId));

    const result: ServiceSongWithDetails[] = [];

    for (const ss of serviceSongsList) {
      const song = await this.getSong(ss.songId);
      if (song) {
        result.push({ ...ss, song });
      }
    }

    return result.sort((a, b) => a.order - b.order);
  }
}

export const storage = new DatabaseStorage();
