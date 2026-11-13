import 'zone.js';
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

type ContactInput = { name: string; phone: string; email: string };
type Contact = ContactInput & { id: string };
const emptyContact = (): ContactInput => ({ name: '', phone: '', email: '' });
const endpoint = '/api/contacts';

async function request<T>(path = '', method = 'GET', data?: ContactInput): Promise<T> {
  const options: RequestInit = { method };
  if (data) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(data);
  }
  const response = await fetch(endpoint + path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'HTTP ' + response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

@Component({
  selector: 'contacts-app',
  standalone: true,
  template: `
    <header><h1>Телефонный справочник</h1></header>
    <form (submit)="save($event)">
      <h2>{{ editingId() ? 'Редактирование контакта' : 'Новый контакт' }}</h2>
      <fieldset [disabled]="busy()">
        <label>Имя <input name="name" required maxlength="100" [value]="draft().name"
          (input)="set('name', $event)"></label>
        <label>Телефон <input name="phone" type="tel" required maxlength="24" [value]="draft().phone"
          (input)="set('phone', $event)"></label>
        <label>Электронная почта <input name="email" type="email" maxlength="254" [value]="draft().email"
          (input)="set('email', $event)"></label>
        <div class="actions"><button type="submit">{{ editingId() ? 'Сохранить' : 'Добавить' }}</button>
        @if (editingId()) { <button type="button" class="secondary" (click)="reset()">Отмена</button> }</div>
      </fieldset>
    </form>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    <p class="status" role="status">{{ notice() }}</p>
    <section>
      <h2>Контакты</h2>
      @if (!contacts().length) { <p>Список пока пуст.</p> }
      @for (contact of contacts(); track contact.id) {
        <article>
          <div><strong>{{ contact.name }}</strong>
            <div>{{ contact.phone }} @if (contact.email) { · {{ contact.email }} }</div>
          </div>
          <div class="actions">
            <button class="secondary" [disabled]="busy()" (click)="edit(contact.id)">Изменить</button>
            <button class="secondary danger" [disabled]="busy()" (click)="remove(contact)">Удалить</button>
          </div>
        </article>
      }
    </section>`
})
class ContactsApp {
  contacts = signal<Contact[]>([]);
  draft = signal(emptyContact());
  editingId = signal('');
  busy = signal(false);
  error = signal('');
  notice = signal('');

  ngOnInit() { void this.run(() => this.load()); }
  async load() { this.contacts.set(await request<Contact[]>()); }

  set(key: keyof ContactInput, event: Event) {
    this.draft.update(value => ({ ...value, [key]: (event.target as HTMLInputElement).value }));
  }

  reset() {
    this.editingId.set('');
    this.draft.set(emptyContact());
  }

  async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try { await action(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.busy.set(false); }
  }

  edit(id: string) {
    return this.run(async () => {
      const { name, phone, email } = await request<Contact>('/' + id);
      this.draft.set({ name, phone, email });
      this.editingId.set(id);
    });
  }

  save(event: Event) {
    event.preventDefault();
    return this.run(async () => {
      const id = this.editingId();
      await request(id ? '/' + id : '', id ? 'PUT' : 'POST', this.draft());
      this.reset();
      await this.load();
      this.notice.set(id ? 'Контакт изменён.' : 'Контакт добавлен.');
    });
  }

  remove(contact: Contact) {
    if (!window.confirm('Удалить контакт «' + contact.name + '»?')) return;
    return this.run(async () => {
      await request('/' + contact.id, 'DELETE');
      if (this.editingId() === contact.id) this.reset();
      await this.load();
      this.notice.set('Контакт удалён.');
    });
  }
}

bootstrapApplication(ContactsApp).catch(console.error);
