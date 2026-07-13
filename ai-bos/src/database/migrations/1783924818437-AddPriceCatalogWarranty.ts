import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPriceCatalogWarranty1783924818437 implements MigrationInterface {
    name = 'AddPriceCatalogWarranty1783924818437'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`price_catalog\` ADD \`warranty_months\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`price_catalog\` DROP COLUMN \`warranty_months\``);
    }

}
