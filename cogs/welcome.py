import discord
from discord.ext import commands
import os


class Welcome(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.welcome_channel_id = int(os.getenv("WELCOME_CHANNEL_ID", 0))
        self.join_role_id = int(os.getenv("JOIN_ROLE_ID", 0))

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        # Assign the initial join role (should only see #rules)
        role = member.guild.get_role(self.join_role_id)
        if role:
            await member.add_roles(role, reason="Auto-assigned on join")

        channel = self.bot.get_channel(self.welcome_channel_id)
        if channel is None:
            return

        embed = discord.Embed(
            title=f"Welcome to {member.guild.name}!",
            description=(
                f"Hey {member.mention}, glad to have you here! "
                f"You are member **#{member.guild.member_count}**.\n\n"
                f"Head over to the rules channel and accept the rules to get full access."
            ),
            color=discord.Color.blurple(),
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        embed.set_footer(text=f"Joined: {member.joined_at.strftime('%B %d, %Y')}")
        await channel.send(embed=embed)


async def setup(bot: commands.Bot):
    await bot.add_cog(Welcome(bot))
