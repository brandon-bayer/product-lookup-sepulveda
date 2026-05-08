import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { db } from "./db";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Predefined users for the dropdown
const predefinedUsers = [
  { displayName: "Brandon Bayer", username: "brandonbayer" },
  { displayName: "Cristy Aguilar", username: "cristyaguilar" },
  { displayName: "Edward Maldonaldo", username: "edwardmaldonaldo" },
  { displayName: "Karen Scott", username: "karenscott" },
  { displayName: "Leticia Piña", username: "leticiapina" },
  { displayName: "Luis Piña", username: "luispina" },
  { displayName: "Lulu Arnold", username: "luluarnold" },
  { displayName: "Marco Bisnar", username: "marcobisnar" },
  { displayName: "Mark Haloossim", username: "markhaloossim" },
  { displayName: "Matthew Green", username: "matthewgreen" },
  { displayName: "Matt Mark", username: "mattmark" },
  { displayName: "Richard Garcia", username: "richardgarcia" },
  { displayName: "Ruben Rodriguez", username: "rubenrodriguez" },
  { displayName: "Shaneen Gottula", username: "shaneengottula" }
];

const COMMON_PASSWORD = "contempo2025";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Function to ensure predefined users exist in the database
async function ensurePredefinedUsers() {
  const hashedPassword = await hashPassword(COMMON_PASSWORD);
  
  for (const user of predefinedUsers) {
    const existingUser = await storage.getUserByUsername(user.username);
    
    if (!existingUser) {
      console.log(`Creating predefined user: ${user.displayName}`);
      await storage.createUser({
        username: user.username,
        password: hashedPassword
      });
    }
  }
}

export function setupAuth(app: Express) {
  // Use PostgreSQL session store for production
  const PostgresSessionStore = connectPg(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'contempo-product-search-secret',
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      createTableIfMissing: true,
      // @ts-ignore - the pg pool is actually db.connection
      pool: db.connection,
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // use secure cookies in production
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Ensure predefined users exist when the server starts
  ensurePredefinedUsers().catch(err => {
    console.error("Error creating predefined users:", err);
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // For our predefined users, we'll accept the common password or their actual password
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false);
        }
        
        // Check if this is a predefined user and it's using the common password
        const isPredefinedUser = predefinedUsers.some(u => u.username === username);
        
        if (isPredefinedUser && password === COMMON_PASSWORD) {
          return done(null, user);
        }
        
        // Otherwise, fall back to normal password check
        if (await comparePasswords(password, user.password)) {
          return done(null, user);
        }
        
        return done(null, false);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // We're keeping the register endpoint for compatibility, though it won't be used in the UI
  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ 
          id: user.id, 
          username: user.username
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/login", (req, res, next) => {
    // Handle passwordless login for predefined users
    if (req.body.noPasswordLogin) {
      // Check if this is a predefined user
      const username = req.body.username;
      const isPredefinedUser = predefinedUsers.some(u => u.username === username);
      
      if (isPredefinedUser) {
        // Get the user from storage
        storage.getUserByUsername(username).then(user => {
          if (!user) {
            return res.status(401).json({ message: "User not found" });
          }
          
          // Log the user in without password verification
          req.login(user, (err: any) => {
            if (err) return next(err);
            
            // Find the display name
            const predefinedUser = predefinedUsers.find(u => u.username === user.username);
            const displayName = predefinedUser ? predefinedUser.displayName : user.username;
            
            return res.status(200).json({ 
              id: user.id, 
              username: user.username,
              displayName
            });
          });
        }).catch(err => {
          console.error("Error in passwordless login:", err);
          return res.status(500).json({ message: "Server error during login" });
        });
      } else {
        return res.status(401).json({ message: "User not authorized for passwordless login" });
      }
    } else {
      // Regular password authentication
      passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: "Invalid username or password" });
        
        req.login(user, (err: any) => {
          if (err) return next(err);
          
          // Find the display name if this is a predefined user
          const predefinedUser = predefinedUsers.find(u => u.username === user.username);
          const displayName = predefinedUser ? predefinedUser.displayName : user.username;
          
          return res.status(200).json({ 
            id: user.id, 
            username: user.username,
            displayName
          });
        });
      })(req, res, next);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user as SelectUser;
    
    // Find the display name if this is a predefined user
    const predefinedUser = predefinedUsers.find(u => u.username === user.username);
    const displayName = predefinedUser ? predefinedUser.displayName : user.username;
    
    res.json({ 
      id: user.id, 
      username: user.username,
      displayName
    });
  });
}