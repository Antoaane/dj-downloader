import { createRouter, createWebHistory } from 'vue-router'
import ConnectSpotify from '../pages/ConnectSpotify.vue'
import ConnectTidal from '../pages/ConnectTidal.vue'
import Dashboard from '../pages/Dashboard.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/connect-spotify', component: ConnectSpotify },
    { path: '/connect-tidal', component: ConnectTidal }
  ]
})
