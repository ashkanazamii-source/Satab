import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type VehicleSettingsSnapshot = {
  route?: null | { id?: number; threshold_m?: number; points?: Array<{ lat:number; lng:number }> };
  geofence?: null | (
    | { type:'circle'; center:{lat:number;lng:number}; radius_m:number; tolerance_m?:number }
    | { type:'polygon'; points:Array<{lat:number;lng:number}>; tolerance_m?:number }
  );
  stations?: Array<{ name:string; lat:number; lng:number; radius_m:number; order_no?:number }>;
};

@Entity('temporary_vehicle_assignment')
@Index(['vehicle_id'])
export class TemporaryVehicleAssignment {
  @PrimaryGeneratedColumn() id: number;

  @Column('int') vehicle_id: number;

  @Column('int') temp_profile_id: number;

  @Column('jsonb') previous_settings: VehicleSettingsSnapshot;

  @Column({ type:'timestamptz' }) starts_at: Date;

  @Index()
  @Column({ type:'timestamptz' }) ends_at: Date;

  @Column({ type:'timestamptz', nullable:true }) restored_at: Date | null;

  @Column({ type:'varchar', length:24, default:'active' })
  status: 'active' | 'restored' | 'cancelled';

  @CreateDateColumn({ type:'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type:'timestamptz' }) updated_at: Date;
}
