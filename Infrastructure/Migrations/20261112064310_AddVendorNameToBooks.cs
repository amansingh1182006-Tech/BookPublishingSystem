using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorNameToBooks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "VendorId",
                table: "Books",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VendorName",
                table: "Books",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Books_VendorId",
                table: "Books",
                column: "VendorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Books_Vendors_VendorId",
                table: "Books",
                column: "VendorId",
                principalTable: "Vendors",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Books_Vendors_VendorId",
                table: "Books");

            migrationBuilder.DropIndex(
                name: "IX_Books_VendorId",
                table: "Books");

            migrationBuilder.DropColumn(
                name: "VendorId",
                table: "Books");

            migrationBuilder.DropColumn(
                name: "VendorName",
                table: "Books");
        }
    }
}
