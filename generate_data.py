import json
import os
import zipfile
from pathlib import Path

import docx

DATA_DIR = "data"
OUTPUT_JSON = "heritage-data.json"
GENERATED_IMAGE_DIR = Path("static/generated_images")


def extract_text_and_images_from_docx(docx_path, image_output_dir):
    """从 docx 文件中提取文本，并把图片落盘为静态文件路径。"""
    try:
        doc = docx.Document(docx_path)
    except Exception as exc:
        print(f"读取 docx 失败: {docx_path} -> {exc}")
        return "", []

    full_text = []
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text:
            full_text.append(text)

    images = []
    try:
        with zipfile.ZipFile(docx_path, "r") as docx_zip:
            image_files = [
                f
                for f in docx_zip.namelist()
                if f.startswith("word/media/")
                and f.split(".")[-1].lower() in ["jpg", "jpeg", "png", "gif"]
            ]

            for index, img_file in enumerate(image_files[:5], start=1):
                try:
                    img_data = docx_zip.read(img_file)
                    img_ext = img_file.split(".")[-1].lower()
                    safe_stem = Path(docx_path).stem.replace(" ", "_")
                    image_name = f"{safe_stem}_{index}.{img_ext}"
                    image_path = image_output_dir / image_name
                    with open(image_path, "wb") as image_file:
                        image_file.write(img_data)
                    images.append(f"./static/generated_images/{image_name}")
                except Exception as exc:
                    print(f"读取图片失败: {img_file} -> {exc}")
    except Exception as exc:
        print(f"解压 docx 失败: {docx_path} -> {exc}")

    return "\n".join(full_text), images


def parse_heritage_data(text, city_name):
    lines = text.split("\n")

    title = lines[0].strip() if lines else f"{city_name}红色遗址"

    location = city_name
    for line in lines:
        if "地址" in line or "位于" in line or "位置" in line:
            location = line.strip()
            break

    description_lines = []
    for line in lines[1:6]:
        if line.strip() and len(line.strip()) > 10:
            description_lines.append(line.strip())
    description = " ".join(description_lines[:3])
    if len(description) < 20:
        description = f"{city_name}拥有丰富的红色文化遗址，是革命历史的重要见证。"

    history = ""
    for i, line in enumerate(lines):
        if "历史" in line or "背景" in line or "时期" in line:
            history_lines = [line.strip()]
            for j in range(1, 3):
                if i + j < len(lines):
                    history_lines.append(lines[i + j].strip())
            history = " ".join(history_lines)
            break
    if not history:
        history = f"{city_name}在革命时期具有重要战略地位，留下了许多珍贵的革命遗址和文物。"

    features = ""
    for i, line in enumerate(lines):
        if "特色" in line or "价值" in line or "意义" in line:
            feature_lines = [line.strip()]
            for j in range(1, 3):
                if i + j < len(lines):
                    feature_lines.append(lines[i + j].strip())
            features = " ".join(feature_lines)
            break
    if not features:
        features = f"{city_name}红色遗址具有重要的历史价值和教育意义，是传承红色基因的重要载体。"

    specialties_by_city = {
        "安阳": ["樱桃", "金丝皇菊", "水冶油酥烧饼", "安阳三熏", "道口烧鸡"],
        "商丘": ["胡辣汤", "永城大枣", "柘城三樱椒", "民权葡萄酒", "宁陵金顶谢花酥梨"],
        "郑州": ["烩面", "新郑大枣", "黄河鲤鱼", "中牟大蒜", "荥阳柿子"],
        "洛阳": ["洛阳水席", "牡丹饼", "偃师银条", "孟津梨", "栾川豆腐"],
        "开封": ["开封小笼包", "花生糕", "杞县大蒜", "尉氏青豆", "兰考泡桐"],
        "南阳": ["南阳黄牛", "西峡香菇", "镇平玉雕", "唐河红薯", "桐柏豆筋"],
        "信阳": ["信阳毛尖", "南湾鱼", "固始鸡", "潢川甲鱼", "新县板栗"],
        "周口": ["逍遥镇胡辣汤", "淮阳黄花菜", "项城白芝麻", "沈丘顾家馍", "鹿邑草帽"],
        "驻马店": ["小磨香油", "正阳花生", "泌阳花菇", "确山板栗", "平舆白芝麻"],
        "新乡": ["原阳大米", "封丘金银花", "辉县山楂", "获嘉饸饹条", "延津胡萝卜"],
        "焦作": ["怀山药", "武陟油茶", "孟州混浆绿豆凉粉", "博爱姜", "沁阳驴肉"],
        "平顶山": ["郏县饸饹面", "鲁山丝绸", "宝丰酒", "叶县岩盐", "汝瓷"],
        "许昌": ["禹州钧瓷", "长葛蜂胶", "鄢陵腊梅", "腐竹", "许昌烟叶"],
        "漯河": ["双汇火腿肠", "北舞渡胡辣汤", "临颍大蒜", "繁城牛肉", "漯河麻鸡"],
        "三门峡": ["灵宝苹果", "大营麻花", "卢氏木耳", "渑池仰韶酒", "陕州糟蛋"],
        "鹤壁": ["浚县石子馍", "淇河鲫鱼", "缠丝鸭蛋", "无核枣", "王桥豆腐"],
        "濮阳": ["濮阳壮馍", "清丰白灵菇", "范县大米", "南乐牙枣", "台前小尾寒羊"],
        "济源": ["冬凌草", "寺郎腰大葱", "济源土馍", "鸡蛋不翻", "玉皇李"],
    }
    specialties = specialties_by_city.get(
        city_name, ["当地特色农产品", "传统手工艺品", "地方特色小吃"]
    )

    return {
        "city": city_name,
        "name": title,
        "location": location,
        "image": "",
        "basicInfo": description,
        "history": history,
        "features": features,
        "address": location,
        "specialties": specialties[:5],
    }


def get_sample_data():
    return [
        {
            "id": 1,
            "city": "安阳",
            "name": "安阳县抗日民主政府旧址",
            "location": "河南省安阳市殷都区磊口乡泉门村",
            "image": "https://via.placeholder.com/600x400/8b0000/ffffff?text=安阳县抗日民主政府旧址",
            "basicInfo": "安阳县抗日民主政府旧址位于河南省安阳市殷都区磊口乡泉门村，是一处承载着抗战历史的红色文化遗址。",
            "history": "1940年前后，为适应抗日战争形势，安阳县抗日民主政府在此成立。",
            "features": "旧址建筑保留了太行山区传统村落布局，具有重要历史与教育价值。",
            "address": "河南省安阳市殷都区磊口乡泉门村",
            "specialties": ["樱桃", "金丝皇菊", "水冶油酥烧饼"],
        },
        {
            "id": 2,
            "city": "商丘",
            "name": "淮海战役总前委旧址",
            "location": "河南省商丘市永城市陈官庄乡",
            "image": "https://via.placeholder.com/600x400/8b0000/ffffff?text=淮海战役总前委旧址",
            "basicInfo": "淮海战役总前委旧址位于商丘市永城市陈官庄乡，是重要的红色文化遗址。",
            "history": "1948年12月至1949年1月，淮海战役总前委曾在此指挥作战。",
            "features": "旧址完整保留了战争时期指挥所风貌，是研究解放战争史的重要实物资料。",
            "address": "河南省商丘市永城市陈官庄乡",
            "specialties": ["永城大枣", "柘城三樱椒", "胡辣汤", "民权葡萄酒"],
        },
    ]


def load_all_heritage_data():
    all_data = []
    GENERATED_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for old_image in GENERATED_IMAGE_DIR.iterdir():
        if old_image.is_file():
            old_image.unlink()

    if not os.path.exists(DATA_DIR):
        print(f"数据目录不存在: {DATA_DIR}，改用示例数据")
        return get_sample_data()

    for city_dir in os.listdir(DATA_DIR):
        city_full_path = os.path.join(DATA_DIR, city_dir)
        if not os.path.isdir(city_full_path):
            continue

        docx_files = [f for f in os.listdir(city_full_path) if f.lower().endswith(".docx")]
        for docx_file in docx_files:
            docx_path = os.path.join(city_full_path, docx_file)
            text, images = extract_text_and_images_from_docx(docx_path, GENERATED_IMAGE_DIR)
            if not text:
                continue

            heritage_data = parse_heritage_data(text, city_dir)
            if images:
                heritage_data["image"] = images[0]
            else:
                heritage_data["image"] = (
                    "https://via.placeholder.com/600x400/8b0000/ffffff?text="
                    + heritage_data["name"]
                )
            all_data.append(heritage_data)

    if not all_data:
        return get_sample_data()

    for idx, item in enumerate(all_data, start=1):
        item["id"] = idx

    return all_data


def main():
    data = load_all_heritage_data()
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已生成 {OUTPUT_JSON}，共 {len(data)} 条记录")


if __name__ == "__main__":
    main()
