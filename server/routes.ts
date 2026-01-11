import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSongSchema, insertServiceSchema, type UserRole } from "@shared/schema";
import * as cheerio from "cheerio";
import { emitServiceUpdate } from "./socket";
import passport, { hashPassword } from "./auth";
import crypto from "crypto";
import { sendProvisionalPasswordEmail, sendPasswordResetEmail, generateNumericPassword } from "./email";

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Nao autenticado" });
}

function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Nao autenticado" });
    }
    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Credenciais invalidas" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Erro ao fazer login" });
        }
        const { passwordHash, invitationToken, invitationExpires, passwordResetToken, passwordResetExpires, ...safeUser } = user;
        return res.json({
          ...safeUser,
          mustChangePassword: user.mustChangePassword || false,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Nao autenticado" });
    }
    const { passwordHash, invitationToken, invitationExpires, passwordResetToken, passwordResetExpires, ...safeUser } = req.user as any;
    res.json({
      ...safeUser,
      mustChangePassword: (req.user as any).mustChangePassword || false,
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { token, password, name } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token e senha sao obrigatorios" });
      }

      const user = await storage.getUserByInvitationToken(token);
      if (!user) {
        return res.status(400).json({ error: "Token invalido ou expirado" });
      }

      if (user.invitationExpires && new Date() > user.invitationExpires) {
        return res.status(400).json({ error: "Token expirado" });
      }

      const passwordHash = await hashPassword(password);
      await storage.activateUser(user.id, passwordHash, name || user.name);

      res.json({ success: true, message: "Conta ativada com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao registrar" });
    }
  });

  app.get("/api/users", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      const safeUsers = users.map(({ passwordHash, invitationToken, invitationExpires, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const existingUser = await storage.getUserByEmail(parsed.data.email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const provisionalPassword = generateNumericPassword(6);
      const hashedPassword = await hashPassword(provisionalPassword);

      const user = await storage.createUserWithProvisionalPassword({
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        role: (parsed.data.role || "membro") as UserRole,
        passwordHash: hashedPassword,
      });

      const emailSent = await sendProvisionalPasswordEmail(user.email, user.name, provisionalPassword);
      console.log(`[EMAIL] Provisional password email sent to ${user.email}: ${emailSent ? 'SUCCESS' : 'FAILED'}`);

      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id/block", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "Usuario nao encontrado" });
      }
      
      if (user.role === "admin") {
        return res.status(403).json({ error: "Nao pode bloquear um admin" });
      }

      const newStatus = user.status === "blocked" ? "active" : "blocked";
      const updatedUser = await storage.updateUserStatus(req.params.id, newStatus);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "Usuario nao encontrado" });
      }

      const { passwordHash, invitationToken, invitationExpires, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  app.delete("/api/users/:id", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "Usuario nao encontrado" });
      }
      
      if (user.role === "admin") {
        return res.status(403).json({ error: "Nao pode excluir um admin" });
      }

      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/users/:id/reset-password", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "Usuario nao encontrado" });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

      await storage.setPasswordResetToken(user.id, resetToken, resetExpires);
      await sendPasswordResetEmail(user.email, user.name, resetToken);

      res.json({ success: true, message: "Email de reset enviado com sucesso" });
    } catch (error) {
      console.error("Error sending reset email:", error);
      res.status(500).json({ error: "Failed to send reset email" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token e senha sao obrigatorios" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Senha deve ter no minimo 8 caracteres" });
      }

      const user = await storage.getUserByPasswordResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Token invalido ou expirado" });
      }

      if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
        return res.status(400).json({ error: "Token expirado" });
      }

      const hashedPassword = await hashPassword(password);
      await storage.resetPasswordWithToken(user.id, hashedPassword);

      res.json({ success: true, message: "Senha redefinida com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao redefinir senha" });
    }
  });

  app.post("/api/auth/change-password", ensureAuthenticated, async (req, res) => {
    try {
      const { password } = req.body;
      const userId = (req.user as any).id;
      
      if (!password) {
        return res.status(400).json({ error: "Senha obrigatoria" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Senha deve ter no minimo 8 caracteres" });
      }

      const hashedPassword = await hashPassword(password);
      await storage.updateUserPasswordAndClearFlag(userId, hashedPassword);

      res.json({ success: true, message: "Senha alterada com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao alterar senha" });
    }
  });

  app.get("/api/songs", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const songs = await storage.getSongs();
      res.json(songs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch songs" });
    }
  });

  app.get("/api/songs/:id", ensureAuthenticated, async (req, res) => {
    try {
      const song = await storage.getSong(req.params.id);
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch song" });
    }
  });

  app.post("/api/songs", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const parsed = insertSongSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const song = await storage.createSong(parsed.data);
      res.status(201).json(song);
    } catch (error) {
      res.status(500).json({ error: "Failed to create song" });
    }
  });

  app.patch("/api/songs/:id", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const { content, originalKey } = req.body;
      const song = await storage.updateSong(req.params.id, { content, originalKey });
      if (!song) {
        return res.status(404).json({ error: "Song not found" });
      }
      res.json(song);
    } catch (error) {
      res.status(500).json({ error: "Failed to update song" });
    }
  });

  app.delete("/api/songs/:id", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      await storage.deleteSong(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete song" });
    }
  });

  app.get("/api/services", ensureAuthenticated, async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.get("/api/services/:id", ensureAuthenticated, async (req, res) => {
    try {
      const service = await storage.getServiceWithSongs(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service" });
    }
  });

  app.post("/api/services", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const parsed = insertServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const service = await storage.createService(parsed.data);
      res.status(201).json(service);
    } catch (error) {
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.patch("/api/services/:id", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const { name, date, time } = req.body;
      const service = await storage.updateService(req.params.id, { name, date, time });
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  app.post("/api/services/:id/songs", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const { songId, transposedKey } = req.body;
      if (!songId) {
        return res.status(400).json({ error: "songId is required" });
      }

      const serviceSong = await storage.addSongToService({
        serviceId: req.params.id,
        songId,
        order: 0,
        transposedKey,
      });
      
      const updatedService = await storage.getServiceWithSongs(req.params.id);
      emitServiceUpdate(req.params.id, updatedService);
      
      res.status(201).json(serviceSong);
    } catch (error) {
      res.status(500).json({ error: "Failed to add song to service" });
    }
  });

  app.patch("/api/services/:serviceId/songs/:serviceSongId", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const { transposedKey, order } = req.body;

      if (order !== undefined) {
        const serviceSong = await storage.updateServiceSongOrder(
          req.params.serviceSongId,
          order
        );
        const updatedService = await storage.getServiceWithSongs(req.params.serviceId);
        emitServiceUpdate(req.params.serviceId, updatedService);
        return res.json(serviceSong);
      }

      if (!transposedKey) {
        return res.status(400).json({ error: "transposedKey or order is required" });
      }

      const serviceSong = await storage.updateServiceSongKey(
        req.params.serviceSongId,
        transposedKey
      );
      const updatedService = await storage.getServiceWithSongs(req.params.serviceId);
      emitServiceUpdate(req.params.serviceId, updatedService);
      res.json(serviceSong);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service song" });
    }
  });

  app.delete("/api/services/:serviceId/songs/:serviceSongId", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      await storage.removeSongFromService(req.params.serviceSongId);
      const updatedService = await storage.getServiceWithSongs(req.params.serviceId);
      emitServiceUpdate(req.params.serviceId, updatedService);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove song from service" });
    }
  });

  app.put("/api/services/:serviceId/songs/reorder", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const { songOrders } = req.body;
      if (!Array.isArray(songOrders)) {
        return res.status(400).json({ error: "songOrders array is required" });
      }

      await storage.reorderServiceSongs(req.params.serviceId, songOrders);
      const updatedService = await storage.getServiceWithSongs(req.params.serviceId);
      emitServiceUpdate(req.params.serviceId, updatedService);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder songs" });
    }
  });

  app.get("/api/cifraclub/search", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const searchUrl = `https://solr.sscdn.co/cc/sr/?q=${encodeURIComponent(query)}&rows=15`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      if (!response.ok) {
        return res.status(500).json({ error: "Failed to search Cifraclub" });
      }

      const text = await response.text();
      let jsonStr = text.trim();
      if (jsonStr.startsWith("suggest_callback(") && jsonStr.endsWith(")")) {
        jsonStr = jsonStr.slice(17, -1);
      } else {
        return res.status(500).json({ error: "Invalid response from Cifraclub" });
      }

      const data = JSON.parse(jsonStr);
      const docs = data?.response?.docs || [];
      
      const results = docs
        .filter((doc: { t: string }) => doc.t === "2")
        .map((doc: { txt: string; art: string; dns: string; url: string }) => ({
          title: doc.txt || "",
          artist: doc.art || "",
          url: `https://www.cifraclub.com.br/${doc.dns}/${doc.url}/`
        }))
        .filter((item: { title: string; artist: string }) => item.title && item.artist)
        .slice(0, 10);

      res.json(results);
    } catch (error) {
      console.error("Cifraclub search error:", error);
      res.status(500).json({ error: "Failed to search Cifraclub" });
    }
  });

  app.get("/api/cifraclub/fetch", ensureAuthenticated, authorizeRoles("admin", "lider"), async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.hostname.endsWith("cifraclub.com.br")) {
          return res.status(400).json({ error: "Only Cifraclub URLs are allowed" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      if (!response.ok) {
        return res.status(500).json({ error: "Failed to fetch song from Cifraclub" });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $("h1.t1, .head-name h1").first().text().trim() || 
                   $("h1").first().text().trim();
      const artist = $("h2.t2 a, .head-name h2 a").first().text().trim() ||
                    $("h2 a").first().text().trim();

      let chordContent = "";
      
      const cifraEl = $("pre.cifra, .cifra_cnt pre, .g-fix pre, #cifra_cnt pre").first();
      if (cifraEl.length) {
        chordContent = cifraEl.text();
      } else {
        $("pre").each((_, el) => {
          const text = $(el).text();
          if (text.match(/[A-G][#b]?m?/)) {
            chordContent = text;
            return false;
          }
        });
      }

      if (!chordContent) {
        return res.status(404).json({ error: "Could not find chord content on page" });
      }

      res.json({
        title: title || "Música",
        artist: artist || "Artista",
        content: chordContent
      });
    } catch (error) {
      console.error("Cifraclub fetch error:", error);
      res.status(500).json({ error: "Failed to fetch song from Cifraclub" });
    }
  });

  return httpServer;
}
