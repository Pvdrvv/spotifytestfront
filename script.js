document.addEventListener('DOMContentLoaded', () => {
    const items = document.querySelectorAll('.album-item');
    const slides = document.querySelectorAll('.bg-slide');

    items.forEach(item => {
        // Mudamos de 'mouseenter' para 'click'
        item.addEventListener('click', () => {
            
            // 1. Remove a classe 'active' de todos os itens de texto
            items.forEach(i => i.classList.remove('active'));
            
            // 2. Remove a classe 'active' de todos os slides de fundo
            slides.forEach(s => s.classList.remove('active'));

            // 3. Adiciona 'active' apenas ao item que foi clicado
            item.classList.add('active');
            
            // 4. Pega o ID do card correspondente e ativa a imagem
            const targetId = item.getAttribute('data-target');
            const targetSlide = document.getElementById(targetId);
            
            if (targetSlide) {
                targetSlide.classList.add('active');
            }
        });
    });
});