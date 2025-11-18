import { dateFnsLocalizer } from 'react-big-calendar';
import {
  parse,
  startOfWeek,
  getDay,
  format,
} from 'date-fns';
import { enUS } from 'date-fns/locale';

const locales = {
  'en-US': enUS,
  en: enUS,
};

export const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

