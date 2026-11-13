import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { loadExperiment } from './experiment.ts'
import { publicExample } from './publicExample.ts'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
loadExperiment().catch(() => null).then(experiment => root.render(<App experiment={experiment ?? publicExample} publicDemo={!experiment} />))
