import { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(500).json({ error: "ADMIN_TOKEN not configured on server" });
  }
  const header = (req.headers["x-admin-token"] || req.headers["x-admin_token"] || req.headers["authorization"]) as string | undefined;
  // Support header form: x-admin-token: <token>
  if (!header) return res.status(403).json({ error: "Forbidden" });

  // If Authorization: Bearer <token> was provided, extract
  let provided = header;
  if (provided.toLowerCase().startsWith("bearer ")) {
    provided = provided.slice(7).trim();
  }

  if (provided !== adminToken) return res.status(403).json({ error: "Forbidden" });
  return next();
}
