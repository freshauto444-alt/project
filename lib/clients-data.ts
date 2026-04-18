export interface ClientReview {
  name: string
  car: string
  text: string
  rating: number
  source: string
  avatar: string
}

export interface GalleryPhoto {
  src: string
  alt: string
  instagramUrl: string
}

export const clientReviews: ClientReview[] = [
  { name: "Андрій М.", car: "BMW M4 CSL", text: "Весь процес від підбору до реєстрації зайняв лише 2 тижні. Дуже задоволений сервісом. Менеджер був на зв'язку 24/7 і відповідав моментально.", rating: 5, source: "Google", avatar: "АМ" },
  { name: "Олена К.", car: "Audi RS e-tron GT", text: "Професійний підхід та повна прозорість. Кожен етап був зрозумілий. Дякую команді Fresh Auto!", rating: 5, source: "Google", avatar: "ОК" },
  { name: "Дмитро С.", car: "Porsche Taycan", text: "Третій автомобіль через Fresh Auto. Завжди все чітко та в строк. Рекомендую всім знайомим.", rating: 5, source: "Google", avatar: "ДС" },
  { name: "Марина П.", car: "Mercedes AMG GT", text: "Відмінний досвід! Авто в ідеальному стані, як і обіцяли. Дуже вдячна за чесність та якість.", rating: 5, source: "Google", avatar: "МП" },
  { name: "Ігор В.", car: "Lamborghini Huracan", text: "Мрія здійснилась завдяки Fresh Auto. Все було організовано бездоганно від першого дзвінка.", rating: 5, source: "Trustpilot", avatar: "ІВ" },
  { name: "Наталія Р.", car: "Ferrari 296 GTB", text: "Шукала конкретну модель довго. Тут знайшли за 10 днів. Неймовірний сервіс!", rating: 5, source: "Trustpilot", avatar: "НР" },
  { name: "Олексій Т.", car: "McLaren 750S", text: "Швидкість роботи вражає. Від замовлення до отримання -- менше місяця. Все прозоро та чесно.", rating: 4, source: "Google", avatar: "ОТ" },
  { name: "Вікторія Д.", car: "Porsche 911 GT3 RS", text: "Вже рекомендувала друзям. Якість обслуговування на найвищому рівні. Дякую!", rating: 5, source: "Facebook", avatar: "ВД" },
]

export const galleryPhotos: GalleryPhoto[] = [
  { src: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=400&q=80", alt: "Porsche 911 GT3 RS доставка", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=400&q=80", alt: "BMW M4 CSL у шоурумі", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400&q=80", alt: "Mercedes AMG GT передача клієнту", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400&q=80", alt: "Audi RS e-tron GT зарядка", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=400&q=80", alt: "Lamborghini Huracan доставка", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80", alt: "Porsche Taycan у салоні", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=400&q=80", alt: "Ferrari 296 GTB огляд", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
  { src: "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=400&q=80", alt: "McLaren 750S тест-драйв", instagramUrl: "https://www.instagram.com/freshauto_ua/" },
]
