import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      passwordHash: string | null;
      role: "admin" | "lider" | "membro";
      status: "pending" | "active" | "blocked";
      invitationToken: string | null;
      invitationExpires: Date | null;
      mustChangePassword: boolean | null;
      passwordResetToken: string | null;
      passwordResetExpires: Date | null;
      createdAt: Date | null;
    }
  }
}

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email.toLowerCase());
        
        if (!user) {
          return done(null, false, { message: "Email ou senha incorretos" });
        }

        if (!user.passwordHash) {
          return done(null, false, { message: "Conta ainda nao ativada. Verifique seu email." });
        }

        if (user.status === "blocked") {
          return done(null, false, { message: "Sua conta foi bloqueada. Entre em contato com o lider." });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return done(null, false, { message: "Email ou senha incorretos" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function seedAdminUser() {
  const adminEmail = "willianlealusa@gmail.com";
  const adminPassword = "D7i9G6i8";
  
  const existingAdmin = await storage.getUserByEmail(adminEmail);
  if (!existingAdmin) {
    const passwordHash = await hashPassword(adminPassword);
    await storage.createUserWithPassword({
      name: "Admin",
      email: adminEmail,
      role: "admin",
      passwordHash,
      status: "active",
    });
    console.log("Admin user created successfully");
  }
}

export default passport;
