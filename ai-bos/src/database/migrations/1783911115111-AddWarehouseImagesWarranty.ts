import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWarehouseImagesWarranty1783911115111 implements MigrationInterface {
    name = 'AddWarehouseImagesWarranty1783911115111'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`inventory_item_images\` (\`id\` uuid NOT NULL, \`tenant_id\` uuid NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`inventory_item_id\` uuid NOT NULL, \`file_name\` varchar(255) NOT NULL, \`file_path\` varchar(255) NOT NULL, \`mime_type\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`inventory_items\` ADD \`warranty_months\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`inventory_items\` ADD \`video_url\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inventory_items\` DROP COLUMN \`video_url\``);
        await queryRunner.query(`ALTER TABLE \`inventory_items\` DROP COLUMN \`warranty_months\``);
        await queryRunner.query(`DROP TABLE \`inventory_item_images\``);
    }

}
