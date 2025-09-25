// vehicle-daily-track.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Interface for storing a single coordinate point.
 * This improves type safety in your application code.
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

@Entity('vehicle_daily_tracks')
// This unique index ensures that there can only be ONE row
// for each vehicle on any given day.
@Index(['vehicle_id', 'track_date'], { unique: true })
export class VehicleDailyTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  vehicle_id: number;

  /**
   * The specific date for which these tracks are recorded.
   * We use 'date' type to store only the day, without time information.
   */
  @Column({ type: 'date' })
  track_date: string; // Stored as 'YYYY-MM-DD'

  /**
   * An array of all geographic points (lat/lng) recorded for the vehicle
   * on the given track_date.
   * Using 'jsonb' is highly recommended for performance with PostgreSQL.
   * It stores the coordinates like: [{lat: 35.7, lng: 51.4}, {lat: 35.71, lng: 51.42}]
   */
  @Column({
    type: 'jsonb',
    array: false, // The data itself is an array, so the column type is just jsonb
    default: [], // Default to an empty array for new entries
    nullable: false,
  })
  track_points: Coordinates[];

  @Column({ type: 'int', nullable: true })
  current_route_id: number | null;
}