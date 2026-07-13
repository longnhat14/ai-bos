import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerSource1783930072465 implements MigrationInterface {
    name = 'AddCustomerSource1783930072465'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`customers\` ADD \`source\` varchar(255) NOT NULL DEFAULT 'counter'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`customers\` DROP COLUMN \`source\``);
    }

}
