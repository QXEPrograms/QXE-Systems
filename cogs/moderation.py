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
    match = re.fullmatch(r"(\d+)([smhd])", text.lower())
    if not match:
        return None
    value, unit = int(match.group(1)), match.group(2)
    return {"s": timedelta(seconds=value), "m": timedelta(minutes=value),
            "h": timedelta(hours=value), "d": timedelta(days=value)}[unit]


def quick_embed(description: str, color: discord.Color) -> discord.Embed:
    return discord.Embed(description=description, color=color)


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
        await member.kick(reason=reason)
        embed = self.mod_embed(discord.Color.orange(), "Member Kicked", member, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    # ── Ban ───────────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(ban_members=True)
    async def ban(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
        await member.ban(reason=reason, delete_message_days=1)
        embed = self.mod_embed(discord.Color.red(), "Member Banned", member, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    @commands.command()
    @commands.has_permissions(ban_members=True)
    async def unban(self, ctx: commands.Context, user_id: int, *, reason: str = None):
        user = await self.bot.fetch_user(user_id)
        await ctx.guild.unban(user, reason=reason)
        embed = self.mod_embed(discord.Color.green(), "Member Unbanned", user, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    # ── Timeout ───────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(moderate_members=True)
    async def timeout(self, ctx: commands.Context, member: discord.Member, duration: str, *, reason: str = None):
        delta = parse_duration(duration)
        if delta is None or delta > timedelta(days=28):
            await ctx.send(
                embed=quick_embed("❌ Invalid duration. Use formats like `10m`, `2h`, `1d` (max 28d).", discord.Color.red()),
                delete_after=5,
            )
            return
        await member.timeout(delta, reason=reason)
        embed = self.mod_embed(discord.Color.yellow(), "Member Timed Out", member, ctx.author, reason, duration)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    @commands.command()
    @commands.has_permissions(moderate_members=True)
    async def untimeout(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
        await member.timeout(None, reason=reason)
        embed = self.mod_embed(discord.Color.green(), "Timeout Removed", member, ctx.author, reason)
        await ctx.send(embed=embed)
        await self.log(ctx.guild, embed)

    # ── Warn ──────────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(kick_members=True)
    async def warn(self, ctx: commands.Context, member: discord.Member, *, reason: str = None):
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
            dm_embed = discord.Embed(
                title=f"⚠️ You were warned in {ctx.guild.name}",
                color=discord.Color.orange(),
            )
            dm_embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
            dm_embed.add_field(name="Total Warnings", value=str(count), inline=False)
            await member.send(embed=dm_embed)
        except discord.Forbidden:
            pass

    @commands.command()
    @commands.has_permissions(kick_members=True)
    async def warnings(self, ctx: commands.Context, member: discord.Member):
        data = load_warnings()
        warns = data.get(str(member.id), [])
        if not warns:
            await ctx.send(embed=quick_embed(f"✅ **{member}** has no warnings.", discord.Color.green()))
            return
        desc = "\n".join(f"**{i+1}.** {w['reason']} — by {w['by']}" for i, w in enumerate(warns))
        embed = discord.Embed(title=f"⚠️ Warnings for {member}", description=desc, color=discord.Color.orange())
        await ctx.send(embed=embed)

    @commands.command()
    @commands.has_permissions(administrator=True)
    async def clearwarnings(self, ctx: commands.Context, member: discord.Member):
        data = load_warnings()
        data.pop(str(member.id), None)
        save_warnings(data)
        await ctx.send(embed=quick_embed(f"✅ Cleared all warnings for **{member}**.", discord.Color.green()))

    # ── Messages ──────────────────────────────────────────────────────────────

    @commands.command()
    @commands.has_permissions(manage_messages=True)
    async def clear(self, ctx: commands.Context, amount: int):
        amount = min(amount, 100)
        await ctx.message.delete()
        deleted = await ctx.channel.purge(limit=amount)
        await ctx.send(
            embed=quick_embed(f"🗑️ Deleted **{len(deleted)}** messages.", discord.Color.blurple()),
            delete_after=4,
        )

    @commands.command()
    @commands.has_permissions(manage_channels=True)
    async def slowmode(self, ctx: commands.Context, seconds: int):
        await ctx.channel.edit(slowmode_delay=seconds)
        desc = f"🐢 Slowmode set to **{seconds}s**." if seconds else "✅ Slowmode disabled."
        await ctx.send(embed=quick_embed(desc, discord.Color.blurple()))

    # ── Error handling ────────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error):
        if isinstance(error, commands.MissingPermissions):
            await ctx.send(
                embed=quick_embed("🚫 You don't have permission to use that command.", discord.Color.red()),
                delete_after=5,
            )
        elif isinstance(error, commands.MemberNotFound):
            await ctx.send(embed=quick_embed("❌ Member not found.", discord.Color.red()), delete_after=5)
        elif isinstance(error, commands.MissingRequiredArgument):
            await ctx.send(
                embed=quick_embed(f"❌ Missing argument: `{error.param.name}`.", discord.Color.red()),
                delete_after=5,
            )


async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
