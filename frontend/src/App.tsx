import { LegacySwitchie } from './components/LegacySwitchie';
import { CardMigrationPreview } from './components/CardMigrationPreview';
import './styles/legacy.css';
import './styles/react.css';
import './styles/reference-ui.css';

export default function App() {
  const cardTest = new URLSearchParams(window.location.search).get('card-test') === '1';
  return cardTest ? <CardMigrationPreview /> : <LegacySwitchie />;
}
