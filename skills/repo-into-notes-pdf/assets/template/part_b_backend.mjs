// Code goes in template literals: escape \` and \${ inside them.
export default ({ part, step, p, code, note, c }) => {
  part("B", "Backend — Express + MongoDB, step by step",
       "A clean rebuild in build order: env, models, core utilities, authentication, modules.", "backend");

  step("Environment variables validated with Zod",
       p("Every variable the code reads is declared and checked at startup."),
       code(`
          import "dotenv/config";
          import { z } from "zod";

          const EnvSchema = z.object({
            NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
            PORT: z.coerce.number().default(8000),
            MONGODB_URL: z.string().min(1),
            JWT_SECRET: z.string().min(32),
          });

          export const env = EnvSchema.parse(process.env);
       `, "ts", "src/config/env.ts"),
       note(`The repo reads ${c("JWT_SECRET")} but its .env never defines it, so signing fails at runtime.`, "repo"));

  step("Authentication — the requireAuth middleware",
       p("Identity always comes from the verified token, never from the request body."),
       code(`
          export const requireAuth: RequestHandler = (req, _res, next) => {
            const [scheme, token] = (req.headers.authorization ?? "").split(" ");
            if (scheme !== "Bearer" || !token) throw unauthorized();
            const user = verifyAccessToken(token);
            if (!user) throw unauthorized(\`Invalid or expired token\`);
            req.user = user;
            next();
          };
       `, "ts", "src/middlewares/auth.ts"),
       note(`Keep the JWT payload small: ${c("{ sub, role }")}.`, "tip"));
};
