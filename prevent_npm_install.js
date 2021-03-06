
!process.env.npm_config_user_agent.startsWith("pnpm")
  && (console.log("Use `pnpm install` to install dependencies in this repository")||true)
  &&process.exit(1)