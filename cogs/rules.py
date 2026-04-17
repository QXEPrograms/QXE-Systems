import discord
from discord.ext import commands
import os


class AcceptRulesView(discord.ui.View):
    """Persistent view so the button works after bot restarts."""

    def __init__(self, verified_role_id: int):
        super().__init__(timeout=None)
        self.verified_role_id = verified_role_id

    @discord.ui.button(
        label="✅ Accept Rules",
        style=discord.ButtonStyle.success,
        custom_id="accept_rules",
    )
    async def accept(self, interaction: discord.Interaction, button: discord.ui.Button):
        role = interaction.guild.get_role(self.verified_role_id)
        if role is None:
            embed = discord.Embed(
                description="❌ Could not find the verified role. Please contact an admin.",
                color=discord.Color.red(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        if role in interaction.user.roles:
            embed = discord.Embed(
                description="✅ You have already accepted the rules!",
                color=discord.Color.green(),
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await interaction.user.add_roles(role, reason="Accepted rules")
        embed = discord.Embed(
            title="Welcome aboard!",
            description="Thanks for accepting the rules! You now have full access to the server. Enjoy your stay!",
            color=discord.Color.green(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)


class Rules(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.verified_role_id = int(os.getenv("VERIFIED_ROLE_ID", 0))

    @commands.Cog.listener()
    async def on_ready(self):
        self.bot.add_view(AcceptRulesView(self.verified_role_id))

    @commands.command(name="postrules")
    @commands.has_permissions(administrator=True)
    async def post_rules(self, ctx: commands.Context, *, rules_text: str = None):
        """Post the rules embed with the Accept button. Admins only."""
        default_rules = (
            "**1.** Be respectful to all members.\n"
            "**2.** No hate speech, harassment, or discrimination.\n"
            "**3.** No spam or self-promotion without permission.\n"
            "**4.** Keep content appropriate and on-topic.\n"
            "**5.** Follow Discord's Terms of Service.\n"
            "**6.** Listen to staff — their decisions are final.\n\n"
            "Click the button below to accept the rules and gain access to the server."
        )

        embed = discord.Embed(
            title=f"📜 {ctx.guild.name} — Server Rules",
            description=rules_text or default_rules,
            color=discord.Color.gold(),
        )
        embed.set_footer(text="By clicking Accept, you agree to follow these rules.")

        await ctx.message.delete()
        await ctx.send(embed=embed, view=AcceptRulesView(self.verified_role_id))

    @post_rules.error
    async def post_rules_error(self, ctx: commands.Context, error):
        if isinstance(error, commands.MissingPermissions):
            embed = discord.Embed(
                description="🚫 You need Administrator permission to use this command.",
                color=discord.Color.red(),
            )
            await ctx.send(embed=embed, delete_after=5)


async def setup(bot: commands.Bot):
    await bot.add_cog(Rules(bot))
