# Converte as fotos dos jogadores (public/img/players/<id>.webp) para WebP de verdade.
#
# Rodar na raiz do projeto (precisa de: pip install pillow):
#     python dados-brutos/converter_fotos_webp.py
#
# Por quê: muitas fotos vieram em PNG, JPEG ou GIF com o nome terminando em .webp.
# O navegador abre assim mesmo, mas o WebP de verdade é bem mais leve.
#
# Para cada arquivo:
#   - já é WebP e tem 150x150 ou menos: pula (converter de novo só perderia qualidade);
#   - senão: abre, cola sobre fundo branco se tiver transparência, reduz para caber em 150x150
#     (sem distorcer) e salva como WebP qualidade 82, por cima do original, com o mesmo nome.
# No fim: quantos foram convertidos, o tamanho da pasta antes e depois, e a conferência de que todos abrem como WebP.
import os
from PIL import Image

PASTA = 'public/img/players'
LADO = 150
QUALIDADE = 82

def tamanho_da_pasta(arqs):
    return sum(os.path.getsize(os.path.join(PASTA, f)) for f in arqs)

def para_rgb_com_fundo_branco(im):
    if im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info):
        im = im.convert('RGBA')
        fundo = Image.new('RGB', im.size, (255, 255, 255))
        fundo.paste(im, mask=im.getchannel('A'))
        return fundo
    return im.convert('RGB')

def main():
    arqs = sorted(f for f in os.listdir(PASTA) if f.endswith('.webp'))
    antes = tamanho_da_pasta(arqs)
    convertidos = pulados = 0
    erros = []
    for i, f in enumerate(arqs, 1):
        caminho = os.path.join(PASTA, f)
        try:
            with Image.open(caminho) as im:
                if im.format == 'WEBP' and im.width <= LADO and im.height <= LADO:
                    pulados += 1
                    continue
                im.seek(0)  # GIF: só o primeiro quadro
                nova = para_rgb_com_fundo_branco(im)
            if nova.width > LADO or nova.height > LADO:
                nova.thumbnail((LADO, LADO), Image.LANCZOS)
            temp = caminho + '.tmp'
            nova.save(temp, 'WEBP', quality=QUALIDADE, method=6)
            os.replace(temp, caminho)  # só troca o original depois de salvar o novo sem erro
            convertidos += 1
        except Exception as e:
            erros.append(f'{f}: {e}')
        if i % 2000 == 0:
            print(f'  {i} de {len(arqs)}...', flush=True)

    depois = tamanho_da_pasta(arqs)
    # Conferência: todos precisam abrir como WebP
    nao_webp = []
    for f in arqs:
        try:
            with Image.open(os.path.join(PASTA, f)) as im:
                im.load()
                if im.format != 'WEBP': nao_webp.append(f'{f} ({im.format})')
        except Exception as e:
            nao_webp.append(f'{f} (não abre: {e})')

    mb = lambda b: f'{b / 1024 / 1024:.0f} MB'
    print(f'Arquivos: {len(arqs)} | convertidos: {convertidos} | já eram WebP (pulados): {pulados} | erros: {len(erros)}')
    for e in erros[:20]: print('  erro:', e)
    print(f'Tamanho da pasta: antes {mb(antes)}, depois {mb(depois)}')
    print('Todos abrem como WebP!' if not nao_webp else f'{len(nao_webp)} NÃO abrem como WebP: ' + ', '.join(nao_webp[:20]))

if __name__ == '__main__':
    main()
