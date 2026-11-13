using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class publishingbook : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                -- 1. Authors Table
                IF OBJECT_ID(N'[dbo].[Authors]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Authors] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [AuthorName] nvarchar(max) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        [ModifiedAt] datetime2 NULL
                    );
                END

                -- 2. Categories Table
                IF OBJECT_ID(N'[dbo].[Categories]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Categories] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [CategoryCode] nvarchar(max) NOT NULL,
                        [CategoryName] nvarchar(max) NOT NULL,
                        [Description] nvarchar(max) NOT NULL,
                        [IsActive] bit NOT NULL,
                        [CreatedAt] datetime2 NOT NULL
                    );
                END

                -- 3. Keywords Table
                IF OBJECT_ID(N'[dbo].[Keywords]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Keywords] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [KeywordCode] nvarchar(max) NOT NULL,
                        [KeywordName] nvarchar(max) NOT NULL,
                        [Description] nvarchar(max) NOT NULL,
                        [IsActive] bit NOT NULL,
                        [CreatedAt] datetime2 NOT NULL
                    );
                END

                -- 4. Languages Table
                IF OBJECT_ID(N'[dbo].[Languages]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Languages] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [LanguageCode] nvarchar(max) NOT NULL,
                        [LanguageName] nvarchar(max) NOT NULL,
                        [IsActive] bit NOT NULL,
                        [CreatedAt] datetime2 NOT NULL
                    );
                END

                -- 5. Plans Table (Base Columns)
                IF OBJECT_ID(N'[dbo].[Plans]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Plans] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [PlanName] nvarchar(100) NOT NULL,
                        [Description] nvarchar(500) NULL,
                        [PriceIncludingTax] decimal(18,2) NOT NULL,
                        [TaxPercentage] decimal(18,2) NOT NULL,
                        [ValidityInDays] int NOT NULL,
                        [TargetUser] nvarchar(50) NOT NULL,
                        [MaxBookLimit] int NOT NULL,
                        [IsActive] bit NOT NULL,
                        [CreatedAt] datetime2 NOT NULL
                    );
                END

                -- 6. UserSubscriptions Table
                IF OBJECT_ID(N'[dbo].[UserSubscriptions]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[UserSubscriptions] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [UserId] nvarchar(max) NOT NULL,
                        [PlanId] uniqueidentifier NOT NULL,
                        [StartDate] datetime2 NOT NULL,
                        [ExpiryDate] datetime2 NOT NULL,
                        [AmountPaid] decimal(18,2) NOT NULL,
                        [TaxAmount] decimal(18,2) NOT NULL,
                        [TransactionId] nvarchar(max) NULL,
                        [Status] nvarchar(50) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [FK_UserSubscriptions_Plans_PlanId] FOREIGN KEY ([PlanId]) REFERENCES [dbo].[Plans] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_UserSubscriptions_PlanId] ON [dbo].[UserSubscriptions] ([PlanId]);
                END

                -- 7. Books Table New Columns (Safe Check)
                IF OBJECT_ID(N'[dbo].[Books]', N'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('dbo.Books', 'AuthorMasterId') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [AuthorMasterId] uniqueidentifier NULL;
                    IF COL_LENGTH('dbo.Books', 'CategoryCode') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [CategoryCode] nvarchar(max) NOT NULL DEFAULT '';
                    IF COL_LENGTH('dbo.Books', 'ISBN') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [ISBN] nvarchar(max) NOT NULL DEFAULT '';
                    IF COL_LENGTH('dbo.Books', 'ItemName') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [ItemName] nvarchar(max) NOT NULL DEFAULT '';
                    IF COL_LENGTH('dbo.Books', 'ItemNo') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [ItemNo] nvarchar(max) NOT NULL DEFAULT '';
                    IF COL_LENGTH('dbo.Books', 'Language') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [Language] nvarchar(max) NOT NULL DEFAULT '';
                    IF COL_LENGTH('dbo.Books', 'LanguageMasterId') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [LanguageMasterId] uniqueidentifier NULL;
                    IF COL_LENGTH('dbo.Books', 'NoOfPages') IS NULL
                        ALTER TABLE [dbo].[Books] ADD [NoOfPages] int NOT NULL DEFAULT 0;
                END

                -- 8. BookSegmentAlpha, Beta, Gamma Tables
                IF OBJECT_ID(N'[dbo].[BookSegmentAlpha]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[BookSegmentAlpha] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [BookId] uniqueidentifier NOT NULL,
                        [ParentChunkId] uniqueidentifier NULL,
                        [StorageRelativePath] nvarchar(max) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [FK_BookSegmentAlpha_Books_BookId] FOREIGN KEY ([BookId]) REFERENCES [dbo].[Books] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_BookSegmentAlpha_BookId] ON [dbo].[BookSegmentAlpha] ([BookId]);
                END

                IF OBJECT_ID(N'[dbo].[BookSegmentBeta]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[BookSegmentBeta] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [BookId] uniqueidentifier NOT NULL,
                        [ParentChunkId] uniqueidentifier NULL,
                        [StorageRelativePath] nvarchar(max) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [FK_BookSegmentBeta_Books_BookId] FOREIGN KEY ([BookId]) REFERENCES [dbo].[Books] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_BookSegmentBeta_BookId] ON [dbo].[BookSegmentBeta] ([BookId]);
                END

                IF OBJECT_ID(N'[dbo].[BookSegmentGamma]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[BookSegmentGamma] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [BookId] uniqueidentifier NOT NULL,
                        [ParentChunkId] uniqueidentifier NULL,
                        [StorageRelativePath] nvarchar(max) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [FK_BookSegmentGamma_Books_BookId] FOREIGN KEY ([BookId]) REFERENCES [dbo].[Books] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_BookSegmentGamma_BookId] ON [dbo].[BookSegmentGamma] ([BookId]);
                END

                -- 9. Customers Table
                IF OBJECT_ID(N'[dbo].[Customers]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Customers] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [CustId] nvarchar(max) NOT NULL,
                        [CustName] nvarchar(max) NOT NULL,
                        [MobileNo] nvarchar(max) NOT NULL,
                        [EmailId] nvarchar(max) NOT NULL,
                        [Address1] nvarchar(max) NOT NULL,
                        [Address2] nvarchar(max) NULL,
                        [Country] nvarchar(max) NOT NULL,
                        [State] nvarchar(max) NOT NULL,
                        [PostalCode] nvarchar(max) NOT NULL,
                        [Landmark] nvarchar(max) NULL,
                        [UserId] nvarchar(450) NOT NULL,
                        [BookId] uniqueidentifier NOT NULL,
                        [PlanType] nvarchar(max) NOT NULL,
                        [AmountPaid] decimal(18,2) NOT NULL,
                        [TransactionId] nvarchar(max) NULL,
                        [PurchasedAt] datetime2 NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        [ApplicationUserId] nvarchar(450) NULL,
                        CONSTRAINT [FK_Customers_Books_BookId] FOREIGN KEY ([BookId]) REFERENCES [dbo].[Books] ([Id]) ON DELETE NO ACTION,
                        CONSTRAINT [FK_Customers_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE NO ACTION
                    );
                    CREATE INDEX [IX_Customers_BookId] ON [dbo].[Customers] ([BookId]);
                    CREATE INDEX [IX_Customers_UserId] ON [dbo].[Customers] ([UserId]);
                END

                -- 10. UserReadingProgress & UserSessions Tables
                IF OBJECT_ID(N'[dbo].[UserReadingProgress]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[UserReadingProgress] (
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [UserId] nvarchar(max) NOT NULL,
                        [BookId] uniqueidentifier NOT NULL,
                        [LastReadPage] int NOT NULL,
                        [TotalPages] int NOT NULL,
                        [LastReadAt] datetime2 NOT NULL,
                        CONSTRAINT [FK_UserReadingProgress_Books_BookId] FOREIGN KEY ([BookId]) REFERENCES [dbo].[Books] ([Id]) ON DELETE NO ACTION
                    );
                    CREATE INDEX [IX_UserReadingProgress_BookId] ON [dbo].[UserReadingProgress] ([BookId]);
                END

                IF OBJECT_ID(N'[dbo].[UserSessions]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[UserSessions] (
                        [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [UserId] nvarchar(450) NOT NULL,
                        [SessionToken] nvarchar(max) NOT NULL,
                        [IpAddress] nvarchar(max) NULL,
                        [LoginTime] datetime2 NOT NULL,
                        [LastActiveTime] datetime2 NOT NULL,
                        [IsActive] bit NOT NULL,
                        CONSTRAINT [FK_UserSessions_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_UserSessions_UserId] ON [dbo].[UserSessions] ([UserId]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}