# Part A — always first. Replace the example content with the analysed project.
from lib import part, step, p, code, table, note, diagram, c

part("A", "Overview — what the project is",
     "One paragraph: what the app does, who uses it, and the main technologies.", "overview")

step("Architecture & data flow",
     p("Name the moving pieces and how a request travels through them."),
     diagram("""
        Browser ──REST (Bearer JWT)──► Express app ──► Mongoose ──► MongoDB
                                         │
                                         └──► Nodemailer ──► SMTP
     """, "big picture"),
     table([
         ["Layering", "Routes → services → models", c("src/modules/*")],
         ["Auth", "JWT in Authorization header", c("src/core/jwt.ts")],
     ], head=["Concept", "How the repo does it", "Where"]))

step("Folder structure — current and recommended",
     p("Show the repo as it is, then the feature-module layout the guide rebuilds."),
     diagram("""
        src/
        ├── config/      env.ts db.ts logger.ts
        ├── core/        errors.ts error-handler.ts validate.ts jwt.ts
        ├── modules/
        │   ├── auth/    auth.routes.ts auth.service.ts auth.schemas.ts
        │   └── users/   user.model.ts user.routes.ts
        ├── app.ts
        └── server.ts
     """, "recommended"),
     note("Group by module, not by layer: everything about users lives in one folder.", "why"))
