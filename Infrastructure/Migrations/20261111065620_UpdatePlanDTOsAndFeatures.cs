using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePlanDTOsAndFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[dbo].[Plans]', N'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('dbo.Plans', 'BasicBookLimit') IS NULL
                        ALTER TABLE [dbo].[Plans] ADD [BasicBookLimit] int NOT NULL DEFAULT 0;

                    IF COL_LENGTH('dbo.Plans', 'BillingPeriod') IS NULL
                        ALTER TABLE [dbo].[Plans] ADD [BillingPeriod] nvarchar(20) NOT NULL DEFAULT 'Monthly';

                    IF COL_LENGTH('dbo.Plans', 'RoyaltyBookLimit') IS NULL
                        ALTER TABLE [dbo].[Plans] ADD [RoyaltyBookLimit] int NOT NULL DEFAULT 0;
                END

                IF OBJECT_ID(N'[dbo].[PlanFeatures]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[PlanFeatures] (
                        [Id] uniqueidentifier NOT NULL,
                        [PlanId] uniqueidentifier NOT NULL,
                        [FeatureName] nvarchar(150) NOT NULL,
                        [Limitation] nvarchar(100) NOT NULL,
                        [IsEnabled] bit NOT NULL,
                        CONSTRAINT [PK_PlanFeatures] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_PlanFeatures_Plans_PlanId] FOREIGN KEY ([PlanId]) REFERENCES [dbo].[Plans] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_PlanFeatures_PlanId] ON [dbo].[PlanFeatures] ([PlanId]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlanFeatures");

            migrationBuilder.DropColumn(
                name: "BasicBookLimit",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "BillingPeriod",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "RoyaltyBookLimit",
                table: "Plans");
        }
    }
}