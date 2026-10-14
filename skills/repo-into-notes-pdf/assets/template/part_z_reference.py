# Part Z sorts last — always end with Reference. Letter it after the last real Part.
from lib import part, step, p, code, table

part("C", "Reference — cheat tables", "The bugs fixed, environment variables and commands, in one place.", "reference")

step("Bugs & gaps fixed vs. the repo",
     table([
         ["Auth middleware imported but never applied", "Critical", "requireAuth on every router"],
         ["Passwords stored in plain text", "Critical", "bcrypt pre-save hook"],
     ], head=["Problem in the repo", "Severity", "Fix in these notes"]))

step("Environment variables & commands",
     table([["MONGODB_URL", "Atlas or the compose service", "yes"],
            ["JWT_SECRET", "32+ random chars", "yes"]], head=["Variable", "Value", "Secret"]),
     code("""
        npm run dev          # tsx watch src/server.ts
        npm test             # vitest
        openssl rand -hex 32 # generate JWT_SECRET
     """, "bash", "terminal"))
