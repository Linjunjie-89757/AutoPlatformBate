import { createApp } from 'vue'
import '@element-plus/icons-vue'

import App from './App.vue'
import { setupAppProviders } from './providers'
import { router } from './router'
import '@/shared/styles/fonts.css'
import '@/shared/styles/tokens.css'
import '@/shared/styles/element-overrides.css'
import '@/shared/styles/global.css'

const app = createApp(App)

setupAppProviders(app)
app.use(router)

app.mount('#app')
