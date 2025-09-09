import { IsArray, IsIn } from 'class-validator';

const CODES = ['IR','QA','AE','IQ','AF','TM','TR'] as const;

export class UpdateAllowedCountriesDto {
  @IsArray()
  @IsIn(CODES as any, { each: true })
  countries: ('IR'|'QA'|'AE'|'IQ'|'AF'|'TM'|'TR')[];
}
