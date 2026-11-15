// Onze — sauvegarde manuelle : export / import JSON, remise à zéro.
import { store, BACKUP_APPS } from './storage.js';
import { $, dayKey, download, toast } from './utils.js';
import { lang, locale, t } from './i18n.js';

export function init() {
  $('#backup-export').addEventListener('click', async () => {
    const backup = await store.exportAll();
    download(`onze-sauvegarde-${dayKey()}.json`, JSON.stringify(backup, null, 2));
    toast('Sauvegarde exportée.');
  });

  $('#backup-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!BACKUP_APPS.includes(backup?.app)) throw new Error('format');
      if (!confirm(t('Importer cette sauvegarde ? Les réglages et données actuels seront remplacés.'))) return;
      await store.importAll(backup);
      location.reload();
    } catch {
      toast('Ce fichier n\'est pas une sauvegarde Onze valide.');
    }
  });

  $('#backup-reset').addEventListener('click', async () => {
    if (!confirm(t('Tout réinitialiser ? Réglages, tâches, notes et habitudes seront effacés de cet appareil.'))) return;
    await store.resetAll();
    location.reload();
  });
}
