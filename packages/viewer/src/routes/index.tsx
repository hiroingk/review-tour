import { createFileRoute } from '@tanstack/react-router';
import { TourIndex } from '../client/TourIndex';

export const Route = createFileRoute('/')({
  component: TourIndex,
});
