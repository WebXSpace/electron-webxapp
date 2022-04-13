import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class SCMEntity {
	@PrimaryColumn()
	name!: string;

	@Column({ nullable: false })
	scriptPath!: string;

	@Column({ nullable: true })
	paramsDescription?: string;

	@Column({ nullable: true })
	defaultParams?: string;

	@Column({ nullable: true })
	params?: string;

	@Column({ nullable: false, default: false })
	disabled!: boolean;

	@Column({ nullable: false, default: true })
	systemService!: boolean;

	@Column({ nullable: false, default: true })
	configable!: boolean;

	@Column({ nullable: false, default: 0 })
	version!: number;
}
