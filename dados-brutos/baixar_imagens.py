"""
Baixa as fotos dos jogadores e os escudos dos clubes em alta resolução, do Sofascore.

Como usar (sempre na raiz do projeto, a pasta "O Plantel"):
    python dados-brutos/baixar_imagens.py                 # baixa tudo (escudos primeiro)
    python dados-brutos/baixar_imagens.py --limite 20     # teste: só 20 imagens
    python dados-brutos/baixar_imagens.py --so-escudos    # só os 214 escudos
    python dados-brutos/baixar_imagens.py --pausa 2       # pausa maior entre pedidos

Depois de baixar, rode de novo o build_final.py para o site passar a usar as imagens:
    python dados-brutos/build_final.py

O que o script faz, passo a passo:
1. Lê os IDs do Sofascore: jogadores em kept.json, clubes em all_pre.json.
2. Para cada ID, pula se a imagem já foi baixada antes. Assim dá para parar
   (Ctrl+C) e rodar de novo depois: ele continua de onde parou.
3. Pede a imagem ao Sofascore, converte para .webp (bem menor que .png) e salva em
   site/img/players/<id>.webp ou site/img/teams/<id>.webp.
4. Espera um tempo aleatório entre cada pedido, e um tempo maior a cada 100,
   para não sobrecarregar o servidor.
5. Se o Sofascore responder 403 ou 429 ("pedidos demais"), espera cada vez mais.
   Depois de 3 bloqueios seguidos, para e avisa. Ele não tenta "driblar" o bloqueio.

Precisa do Pillow (biblioteca de imagens):  python -m pip install pillow
"""
import argparse
import io
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta o Pillow. Instale com:  python -m pip install pillow")

BASE = "https://api.sofascore.app/api/v1"
PASTA_JOGADORES = "site/img/players"
PASTA_TIMES = "site/img/teams"
ARQ_SEM_FOTO = "dados-brutos/imagens_sem_foto.json"  # IDs que deram 404 (não têm imagem)
TAMANHO_MAX = 256  # px; as originais costumam ser menores, mas limitamos por segurança
# Identificação honesta: diz o que é este programa, sem fingir ser um navegador.
CABECALHOS = {"User-Agent": "plantel-imagens/1.0 (projeto pessoal de estudo)"}


def ler_json(caminho, padrao=None):
    if not os.path.exists(caminho):
        return padrao
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def salvar_json(caminho, dados):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f)


def baixar(url):
    """Devolve (código_http, bytes). Código 0 = erro de rede."""
    pedido = urllib.request.Request(url, headers=CABECALHOS)
    try:
        with urllib.request.urlopen(pedido, timeout=20) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"   erro de rede: {e}")
        return 0, b""


def salvar_webp(conteudo, destino):
    img = Image.open(io.BytesIO(conteudo))
    img = img.convert("RGBA")  # mantém o fundo transparente dos escudos
    img.thumbnail((TAMANHO_MAX, TAMANHO_MAX))
    temporario = destino + ".tmp"
    img.save(temporario, "WEBP", quality=85, method=6)
    os.replace(temporario, destino)  # só aparece o arquivo final se tudo deu certo


def main():
    ap = argparse.ArgumentParser(description="Baixa fotos e escudos do Sofascore")
    ap.add_argument("--limite", type=int, default=0, help="máximo de imagens a baixar nesta rodada")
    ap.add_argument("--pausa", type=float, default=1.0, help="pausa mínima entre pedidos, em segundos")
    ap.add_argument("--so-escudos", action="store_true")
    ap.add_argument("--so-jogadores", action="store_true")
    args = ap.parse_args()

    if not os.path.exists("dados-brutos/kept.json"):
        sys.exit("Rode este script na raiz do projeto (a pasta 'O Plantel').")

    os.makedirs(PASTA_JOGADORES, exist_ok=True)
    os.makedirs(PASTA_TIMES, exist_ok=True)

    # 1. Monta a lista do que baixar
    ids_jogadores = ler_json("dados-brutos/kept.json")
    ids_times = [c["sid"] for c in ler_json("dados-brutos/all_pre.json")["clubs"]]
    sem_foto = ler_json(ARQ_SEM_FOTO, {"player": [], "team": []})
    ja_sem = {"player": set(sem_foto["player"]), "team": set(sem_foto["team"])}

    tarefas = []  # (tipo, id, pasta)
    if not args.so_jogadores:
        tarefas += [("team", i, PASTA_TIMES) for i in ids_times]
    if not args.so_escudos:
        tarefas += [("player", i, PASTA_JOGADORES) for i in ids_jogadores]

    # 2. Pula o que já existe
    pendentes = [t for t in tarefas
                 if not os.path.exists(f"{t[2]}/{t[1]}.webp") and t[1] not in ja_sem[t[0]]]
    if args.limite:
        pendentes = pendentes[:args.limite]
    print(f"{len(tarefas)} imagens no total, {len(pendentes)} para baixar agora.")
    if pendentes:
        minutos = len(pendentes) * args.pausa * 1.5 / 60
        print(f"Tempo estimado: uns {minutos:.0f} minutos. Pode parar com Ctrl+C e continuar depois.\n")

    ok = falhas = bloqueios_seguidos = 0
    try:
        for n, (tipo, ident, pasta) in enumerate(pendentes, 1):
            codigo, conteudo = baixar(f"{BASE}/{tipo}/{ident}/image")

            if codigo == 200:
                try:
                    salvar_webp(conteudo, f"{pasta}/{ident}.webp")
                    ok += 1
                    bloqueios_seguidos = 0
                except Exception as e:
                    print(f"   {tipo} {ident}: imagem inválida ({e})")
                    falhas += 1
            elif codigo == 404:
                ja_sem[tipo].add(ident)  # não tem imagem; não pede de novo
            elif codigo in (403, 429):
                # 5. Bloqueado: espera cada vez mais; desiste depois de 3 vezes seguidas
                bloqueios_seguidos += 1
                if bloqueios_seguidos >= 3:
                    print(f"\nO Sofascore bloqueou ({codigo}) 3 vezes seguidas. Parando.")
                    print("Tente de novo mais tarde (ou com --pausa maior). O script continua de onde parou.")
                    break
                espera = 60 * 2 ** (bloqueios_seguidos - 1)
                print(f"   bloqueado ({codigo}). Esperando {espera}s...")
                time.sleep(espera)
                continue
            else:
                print(f"   {tipo} {ident}: resposta {codigo}")
                falhas += 1

            if n % 25 == 0 or n == len(pendentes):
                print(f"{n}/{len(pendentes)}  baixadas: {ok}  sem foto: {len(ja_sem['player']) + len(ja_sem['team'])}  falhas: {falhas}")

            # 4. Pausas para não sobrecarregar o servidor
            time.sleep(random.uniform(args.pausa, args.pausa * 2))
            if n % 100 == 0:
                print("   pausa longa (30s)...")
                time.sleep(30)
    except KeyboardInterrupt:
        print("\nInterrompido. Rode de novo para continuar de onde parou.")
    finally:
        salvar_json(ARQ_SEM_FOTO, {"player": sorted(ja_sem["player"]), "team": sorted(ja_sem["team"])})

    print(f"\nFim desta rodada: {ok} imagens novas.")
    print("Agora rode:  python dados-brutos/build_final.py")


if __name__ == "__main__":
    main()
