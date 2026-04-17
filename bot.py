import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID", 0))
WELCOME_ROLE_ID = int(os.getenv("WELCOME_ROLE_ID", 0))

intents = discord.Intents.default()
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")


@bot.event
async def on_member_join(member: discord.Member):
    channel = bot.get_channel(WELCOME_CHANNEL_ID)
    if channel is None:
        return

    embed = discord.Embed(
        title=f"Welcome to {member.guild.name}!",
        description=(
            f"Hey {member.mention}, glad to have you here! "
            f"You are member **#{member.guild.member_count}**."
        ),
        color=discord.Color.blurple(),
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.set_footer(text=f"Joined: {member.joined_at.strftime('%B %d, %Y')}")

    await channel.send(embed=embed)

    role = member.guild.get_role(WELCOME_ROLE_ID)
    if role:
        await member.add_roles(role, reason="Auto-assigned on join")


bot.run(TOKEN)
