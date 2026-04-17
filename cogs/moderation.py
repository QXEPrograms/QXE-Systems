import discord
from discord.ext import commands
from datetime import timedelta
import json
import os
import re


WARNINGS_FILE = "warnings.json"


def load_warnings() -> dict:
    if os.path.exists(WARNINGS_FILE):
        with open(WARNINGS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_warnings(data: dict):
    with open(WARNINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def parse_duration(text: str) -> timedelta | None:
    """Parse strings like 10m, 2h, 1d into a timedelta."""
    match = re.fullmatch(r"(\d+)([smhd])", text.lower())
    if not match:
        return None
    value, unit = int(match.group(1)), match.group(2)
    return {"s": timedelta(seconds=value), "m": timedelta(minutes=value),
            "h": timedelta(hours=value), "d": timedelta(days=value)}[unit]


class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.log_channel_id = int(os.getenv("MOD_LOG_CHANNEL_ID", 0))

    async def log(self, guild: discord.Guild, embed: discord.Embed):
        channel = guild.get_channel(self.log_channel_id)
        if channel:
            await channel.send(embed=embed)

    def mod_embed(self, color, action, target, moderator, reason=None, extra=None):
        embed = discord.Embed(title=f"🛡️ {action}", color=color)
        embed.add_field(name="User", value=f"{target} (`{target.id}`)", inline=False)
        embed.add_field(name="Moderator", value=str(moderator), inline=False)
        if extra:
            embed.add_field(name="Duration", value=extra, inline=False)
        embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
        return embed

    # ── Kick ──────────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(kick_members=True)
    async def kick(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
        """Kick a member from the server."""
        await member.kick(reason=reason)
        embed = self.mod_embed(discord.Color.orange(), "Member Kicked", member, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    # ── Ban ───────────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(ban_members=True)
    async def ban(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
        """Ban a member from the server."""
        await member.ban(reason=reason, delete_message_days=1)
        embed = self.mod_embed(discord.Color.red(), "Member Banned", member, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    @commands.command()
    @commands.has_permissions(ban_members=True)
    async def unban(self, ctx: commands.Context, user_id: int, *, reason: str = None):
        """Unban a user by their ID."""
        user = await self.bot.fetch_user(user_id)
        await ctx.guild.unban(user, reason=reason)
        await ctx.send(f"Unbanned **{user}**.")

    # ── Timeout ───────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(moderate_members=True)
    async def timeout(self, ctx: commands.Context, member: discord.Member, duration: str, *, reason: str = None):
        """Timeout a member. Duration format: 10m, 2h, 1d (max 28d)."""
        delta = parse_duration(duration)
        if delta is None or delta > timedelta(days=28):
            await ctx.send("Invalid duration. Use formats like `10m`, `2h`, `1d` (max 28d).", delete_after=5)
            return
        await member.timeout(delta, reason=reason)
        embed = self.mod_embed(discord.Color.yellow(), "Member Timed Out", member, ctx.author, reason, duration)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    @commands.command()
    @commands.has_permissions(moderate_members=True)
    async def untimeout(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
        """Remove a timeout from a member."""
        await member.timeout(None, reason=reason)
        await ctx.send(f"Removed timeout from **{member}**.")

    # ── Warn ──────────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(kick_members=True)
    async def warn(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
        """Warn a member and log it."""
        data = load_warnings()
        key = str(member.id)
        if key not in data:
            data[key] = []
        data[key].append({"reason": reason or "No reason provided", "by": str(ctx.author)})
        save_warnings(data)

        count = len(data[key])
        embed = self.mod_embed(discord.Color.orange(), f"Member Warned (#{count})", member, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

        try:
            await member.send(
                f"You have been warned in **{ctx.guild.name}**.\n"
                f"Reason: {reason or 'No reason provided'}\nTotal warnings: {count}"
            )
        except discord.Forbidden:
            pass

    @commands.command()
    @commands.has_permissions(kick_members=True)
    async def warnings(self, ctx: commands.Context, member: discord.Member):
        """View warnings for a member."""
        data = load_warnings()
        warns = data.get(str(member.id), [])
        if not warns:
            await ctx.send(f"**{member}** has no warnings.")
            return
        desc = "\n".join(f"**{i+1}.** {w['reason']} — by {w['by']}" for i, w in enumerate(warns))
        embed = discord.Embed(title=f"Warnings for {member}", description=desc, color=discord.Color.orange())
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def clearwarnings(self, ctx: commands.Context, member: discord.Member):
        """Clear all warnings for a member."""
        data = load_warnings()
        data.pop(str(member.id), None)
        save_warnings(data)
        await ctx.send(f"Cleared all warnings for **{member}**.")

    # ── Messages ──────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(manage_messages=True)
    async def clear(self, ctx: commands.Context, amount: int):
        """Delete messages from the current channel (max 100)."""
        amount = min(amount, 100)
        await ctx.message.delete()
        deleted = await ctx.channel.purge(limit=amount)
        await ctx.send(f"Deleted **{len(deleted)}** messages.", delete_after=4)

    @commands.command()
    @commands.has_permissions(manage_channels=True)
    async def slowmode(self, ctx: commands.Context, seconds: int):
        """Set slowmode for the current channel (0 to disable)."""
        await ctx.channel.edit(slowmode_delay=seconds)
        msg = f"Slowmode set to **{seconds}s**." if seconds else "Slowmode disabled."
        await ctx.send(msg)

    # ── Error handling ────────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error):
        if isinstance(error, commands.MissingPermissions):
            await ctx.send("You don't have permission to use that command.", delete_after=5)
        elif isinstance(error, commands.MemberNotFound):
            await ctx.send("Member not found.", delete_after=5)
        elif isinstance(error, commands.MissingRequiredArgument):
            await ctx.send(f"Missing argument: `{error.param.name}`.", delete_after=5)


async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
