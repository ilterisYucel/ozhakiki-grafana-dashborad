import { PanelPlugin } from '@grafana/data';
import { RackController } from './components/RackController';

export const plugin = new PanelPlugin<{}>(RackController);
