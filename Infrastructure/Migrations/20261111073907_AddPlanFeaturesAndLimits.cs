using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanFeaturesAndLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Safe Column Alteration for 'Plans' Table
            migrationBuilder.AlterColumn<string>(
                name: "BillingPeriod",
                table: "Plans",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);

            // 2. Sql script check: Table tabhi banega agar DB me pehle se nahi exist karta
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PlanFeatures]') AND type in (N'U'))
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
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PlanFeatures]') AND type in (N'U'))
                BEGIN
                    DROP TABLE [dbo].[PlanFeatures];
                END
            ");

            migrationBuilder.AlterColumn<string>(
                name: "BillingPeriod",
                table: "Plans",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);
        }
    }
}