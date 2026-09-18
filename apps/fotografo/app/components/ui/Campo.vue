<script setup lang="ts">
/** Input com rótulo, ajuda e erro. `v-model` direto no valor. */
withDefaults(
  defineProps<{
    rotulo: string;
    modelValue: string | null | undefined;
    type?: string;
    placeholder?: string;
    autocomplete?: string;
    erro?: string;
    ajuda?: string;
    required?: boolean;
    disabled?: boolean;
    maxlength?: number;
    linhas?: number;
  }>(),
  { type: 'text' },
);
defineEmits<{ 'update:modelValue': [valor: string] }>();
</script>

<template>
  <label class="block">
    <span class="rotulo flex items-center justify-between">
      {{ rotulo }}
      <slot name="acao" />
    </span>
    <textarea
      v-if="linhas"
      :value="modelValue ?? ''"
      :rows="linhas"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :maxlength="maxlength"
      class="campo h-auto resize-y py-2.5"
      :class="{ 'border-danger': erro }"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      :maxlength="maxlength"
      class="campo"
      :class="{ 'border-danger': erro }"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="erro" class="mt-1 block text-xs text-danger">{{ erro }}</span>
    <span v-else-if="ajuda" class="mt-1 block text-xs text-muted">{{ ajuda }}</span>
  </label>
</template>
