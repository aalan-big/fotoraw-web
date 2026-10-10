<script setup lang="ts">
/**
 * Liga a notificação de pagamento NESTE aparelho (Web Push). No Android funciona direto
 * no Chrome; no iPhone só depois de "Adicionar à Tela de Início" e abrir pelo ícone.
 */
interface EstadoPush {
  ativo: boolean;
  chavePublica: string | null;
  aparelhos: number;
}

const api = useApi();
const estado = ref<EstadoPush | null>(null);
const suportado = ref(false);
const inscrito = ref(false);
const permissao = ref<NotificationPermission>('default');
const iphoneSemInstalar = ref(false);
const ocupado = ref(false);
const msg = ref<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);

function chaveParaBytes(base64: string) {
  const preenchido = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(preenchido), (c) => c.charCodeAt(0));
}

async function registro() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

async function carregar() {
  suportado.value = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalado = window.matchMedia('(display-mode: standalone)').matches;
  iphoneSemInstalar.value = ios && !instalado;
  if (!suportado.value) return;
  permissao.value = Notification.permission;
  try {
    estado.value = await api<EstadoPush>('/admin/notificacoes');
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    inscrito.value = !!(await reg?.pushManager.getSubscription());
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  }
}

async function ativar() {
  if (!estado.value?.chavePublica) return;
  ocupado.value = true;
  msg.value = null;
  try {
    permissao.value = await Notification.requestPermission();
    if (permissao.value !== 'granted') {
      msg.value = {
        tipo: 'aviso',
        texto: 'Permissão negada. Libere as notificações do site nas configurações do navegador.',
      };
      return;
    }
    const reg = await registro();
    const inscricao =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(estado.value.chavePublica),
      }));
    await api('/admin/notificacoes/inscrever', { method: 'POST', body: inscricao.toJSON() });
    inscrito.value = true;
    await testar();
  } catch (e) {
    msg.value = {
      tipo: 'erro',
      texto: (e as { data?: unknown })?.data ? lerErroApi(e).mensagem : `Não deu pra ativar: ${(e as Error).message}`,
    };
  } finally {
    ocupado.value = false;
    estado.value = await api<EstadoPush>('/admin/notificacoes').catch(() => estado.value);
  }
}

async function desativar() {
  ocupado.value = true;
  msg.value = null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const inscricao = await reg?.pushManager.getSubscription();
    if (inscricao) {
      await api('/admin/notificacoes/inscrever', {
        method: 'DELETE',
        body: { endpoint: inscricao.endpoint },
      });
      await inscricao.unsubscribe();
    }
    inscrito.value = false;
    msg.value = { tipo: 'sucesso', texto: 'Notificações desligadas neste aparelho.' };
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  } finally {
    ocupado.value = false;
    estado.value = await api<EstadoPush>('/admin/notificacoes').catch(() => estado.value);
  }
}

async function testar() {
  try {
    const r = await api<{ entregues: number }>('/admin/notificacoes/testar', { method: 'POST' });
    msg.value = r.entregues
      ? { tipo: 'sucesso', texto: 'Notificação de teste enviada — deve aparecer em alguns segundos.' }
      : { tipo: 'aviso', texto: 'Nenhum aparelho recebeu. Desative e ative de novo.' };
  } catch (e) {
    msg.value = { tipo: 'erro', texto: lerErroApi(e).mensagem };
  }
}

onMounted(carregar);
</script>

<template>
  <UiCartao
    titulo="Notificações neste aparelho"
    descricao="Aviso no celular quando entrar um pagamento de plano ou um cartão for recusado."
  >
    <div class="space-y-3 text-sm">
      <UiAlerta v-if="msg" :tipo="msg.tipo">{{ msg.texto }}</UiAlerta>

      <p v-if="iphoneSemInstalar" class="text-muted">
        No iPhone: toque em <strong class="text-text">Compartilhar</strong> →
        <strong class="text-text">Adicionar à Tela de Início</strong>, abra o admin pelo ícone e
        ative aqui.
      </p>
      <p v-else-if="!suportado" class="text-muted">
        Este navegador não recebe notificações. No celular, use o Chrome (Android) ou o admin
        instalado na tela de início (iPhone).
      </p>
      <p v-else-if="estado && !estado.ativo" class="text-muted">
        As notificações ainda não estão configuradas no servidor (chaves VAPID no .env).
      </p>
      <template v-else-if="estado">
        <p class="text-muted">
          <template v-if="inscrito">
            <strong class="text-success">Ativas neste aparelho.</strong>
          </template>
          <template v-else>Desligadas neste aparelho.</template>
          {{ estado.aparelhos }}
          {{ estado.aparelhos === 1 ? 'aparelho cadastrado' : 'aparelhos cadastrados' }} na sua conta.
        </p>
        <div class="flex flex-wrap gap-2">
          <UiBotao v-if="!inscrito" :disabled="ocupado" @click="ativar">
            {{ ocupado ? 'Ativando…' : 'Ativar notificações' }}
          </UiBotao>
          <template v-else>
            <UiBotao variante="secundaria" :disabled="ocupado" @click="testar">Testar</UiBotao>
            <UiBotao variante="fantasma" :disabled="ocupado" @click="desativar">Desativar</UiBotao>
          </template>
        </div>
      </template>
    </div>
  </UiCartao>
</template>
