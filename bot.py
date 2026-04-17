import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")

intents = discord.Intents.default()
intents.members = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

COGS = ["cogs.welcome", "cogs.rules", "cogs.moderation"]

MOD_ROLE_ID = int(os.getenv("MOD_ROLE_ID", 0))


@bot.check
async def global_mod_check(ctx: commands.Context) -> bool:
    """Block all commands from users who aren't mods or admins."""
    if ctx.author.guild_permissions.administrator:
        return True
    if MOD_ROLE_ID and any(r.id == MOD_ROLE_ID for r in ctx.author.roles):
        return True
    if ctx.author.guild_permissions.manage_messages:
        return True
    raise commands.CheckFailure()


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")


async def main():
    async with bot:
        for cog in COGS:
            await bot.load_extension(cog)
        await bot.start(TOKEN)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
