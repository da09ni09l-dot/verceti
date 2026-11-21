import LoginForm from "./login-form";

export default function LoginPage() {
  return <main className="login-wrap"><section className="login-card">
    <div className="brand" style={{padding:0}}>VERCETI<small>PRIVATE COMMUNITY</small></div>
    <h1 style={{fontSize:27,marginTop:28}}>Вхід до спільноти</h1>
    <p className="muted" style={{fontSize:12,lineHeight:1.7}}>Закритий доступ. Увійти можуть лише запрошені учасники.</p>
    <LoginForm />
    <p className="page-note">Реєстрація для всіх вимкнена. Запрошення видаватиме уповноважене керівництво.</p>
  </section></main>;
}
