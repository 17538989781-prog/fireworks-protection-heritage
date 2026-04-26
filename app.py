from flask import Flask, render_template, jsonify, send_from_directory
import os
import json
import docx
from pathlib import Path
import re
import base64
from io import BytesIO
from PIL import Image
import zipfile

app = Flask(__name__)

# 配置
DATA_DIR = "data"
TEMP_IMAGE_DIR = "static/temp_images"
os.makedirs(TEMP_IMAGE_DIR, exist_ok=True)


def extract_text_and_images_from_docx(docx_path):
    """从docx文件中提取文本和图片"""
    try:
        doc = docx.Document(docx_path)

        # 提取所有文本
        full_text = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                full_text.append(paragraph.text)

        # 提取图片（从docx的媒体文件夹）
        images = []
        try:
            # 解压docx文件（它实际上是一个zip文件）
            with zipfile.ZipFile(docx_path, 'r') as docx_zip:
                # 查找所有图片文件
                image_files = [f for f in docx_zip.namelist()
                               if f.startswith('word/media/') and f.split('.')[-1].lower() in ['jpg', 'jpeg', 'png',
                                                                                               'gif']]

                for i, img_file in enumerate(image_files[:5]):  # 最多提取5张图片
                    try:
                        # 读取图片数据
                        img_data = docx_zip.read(img_file)

                        # 生成唯一的文件名
                        img_filename = f"img_{Path(docx_path).stem}_{i + 1}.jpg"
                        img_path = os.path.join(TEMP_IMAGE_DIR, img_filename)

                        # 保存图片
                        with open(img_path, 'wb') as f:
                            f.write(img_data)

                        # 转换图片为base64（用于网页直接显示）
                        img_base64 = base64.b64encode(img_data).decode('utf-8')
                        img_format = img_file.split('.')[-1].lower()
                        img_data_url = f"data:image/{img_format};base64,{img_base64}"

                        images.append({
                            'path': f"temp_images/{img_filename}",
                            'data_url': img_data_url,
                            'filename': img_filename
                        })
                    except Exception as e:
                        print(f"处理图片时出错 {img_file}: {e}")
        except Exception as e:
            print(f"解压docx文件时出错: {e}")

        return "\n".join(full_text), images
    except Exception as e:
        print(f"读取docx文件时出错 {docx_path}: {e}")
        return "", []


def parse_heritage_data(text, city_name, docx_path):
    """解析从docx提取的文本，转换为结构化的遗址数据"""

    # 尝试自动提取信息（根据常见的文档结构）
    lines = text.split('\n')

    # 提取标题（通常是第一行）
    title = lines[0].strip() if len(lines) > 0 else f"{city_name}红色遗址"

    # 提取位置（查找包含"地址"、"位于"、"位置"的行）
    location = city_name
    for line in lines:
        if '地址' in line or '位于' in line or '位置' in line:
            location = line.strip()
            break

    # 提取描述（取前3-5行作为简介）
    description_lines = []
    for i, line in enumerate(lines[1:6]):  # 跳过第一行标题
        if line.strip() and len(line.strip()) > 10:  # 只取有内容的行
            description_lines.append(line.strip())
    description = ' '.join(description_lines[:3])  # 最多3行

    # 如果描述太短，使用通用描述
    if len(description) < 20:
        description = f"{city_name}拥有丰富的红色文化遗址，是革命历史的重要见证。"

    # 提取历史背景（查找包含"历史"、"背景"、"时期"的行）
    history = ""
    for i, line in enumerate(lines):
        if '历史' in line or '背景' in line or '时期' in line:
            # 取这一行和接下来的2行
            history_lines = [line.strip()]
            for j in range(1, 3):
                if i + j < len(lines):
                    history_lines.append(lines[i + j].strip())
            history = ' '.join(history_lines)
            break

    if not history:
        history = f"{city_name}在革命时期具有重要战略地位，留下了许多珍贵的革命遗址和文物。"

    # 提取特色与价值
    features = ""
    for i, line in enumerate(lines):
        if '特色' in line or '价值' in line or '意义' in line:
            # 取这一行和接下来的2行
            feature_lines = [line.strip()]
            for j in range(1, 3):
                if i + j < len(lines):
                    feature_lines.append(lines[i + j].strip())
            features = ' '.join(feature_lines)
            break

    if not features:
        features = f"{city_name}红色遗址具有重要的历史价值和教育意义，是传承红色基因的重要载体。"

    # 当地特产（预设列表）
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

    specialties = specialties_by_city.get(city_name, ["当地特色农产品", "传统手工艺品", "地方特色小吃"])

    return {
        "id": len(lines),  # 使用行数作为简单ID
        "city": city_name,
        "name": title,
        "location": location,
        "image": "",  # 将在后面添加
        "basicInfo": description,
        "history": history,
        "features": features,
        "address": location,
        "specialties": specialties[:5]  # 最多5个特产
    }


def load_all_heritage_data():
    """加载所有城市的遗址数据"""
    all_data = []

    if not os.path.exists(DATA_DIR):
        print(f"数据目录 {DATA_DIR} 不存在，创建示例数据")
        return get_sample_data()

    # 遍历data目录下的所有城市文件夹
    for city_dir in os.listdir(DATA_DIR):
        city_full_path = os.path.join(DATA_DIR, city_dir)

        if os.path.isdir(city_full_path):
            # 查找城市文件夹中的docx文件
            docx_files = [f for f in os.listdir(city_full_path)
                          if f.lower().endswith('.docx')]

            for docx_file in docx_files:
                docx_path = os.path.join(city_full_path, docx_file)

                # 从docx提取文本和图片
                text, images = extract_text_and_images_from_docx(docx_path)

                if text:  # 如果有文本内容
                    # 解析遗址数据
                    heritage_data = parse_heritage_data(text, city_dir, docx_path)

                    # 如果有图片，使用第一张
                    if images:
                        heritage_data["image"] = images[0]["data_url"]
                    else:
                        # 使用占位图
                        heritage_data[
                            "image"] = f"https://via.placeholder.com/600x400/8b0000/ffffff?text={heritage_data['name']}"

                    all_data.append(heritage_data)

    # 如果没有找到数据，使用示例数据
    if not all_data:
        all_data = get_sample_data()

    return all_data


def get_sample_data():
    """如果没有找到docx文件，返回示例数据"""
    return [
        {
            "id": 1,
            "city": "安阳",
            "name": "安阳县抗日民主政府旧址",
            "location": "河南省安阳市殷都区磊口乡泉门村",
            "image": "https://via.placeholder.com/600x400/8b0000/ffffff?text=安阳县抗日民主政府旧址",
            "basicInfo": "安阳县抗日民主政府旧址位于河南省安阳市殷都区磊口乡泉门村，是一处承载着抗战历史的红色文化遗址，是河南省重点文物保护单位(2016年公布)，也是安阳市重要的红色教育基地之一。旧址建筑群占地约2500平方米，保留了清末民初时期的传统民居风格，现存房屋90余间。",
            "history": "1940年前后，为适应抗日战争形势，安阳县抗日民主政府在此成立(具体办公区域包含13个科室)，同时在村西山后配套设有兵工厂，承担着抗战时期安阳地区的行政指挥、物资保障等职能，是当地抗日斗争的重要指挥枢纽之一。",
            "features": "旧址建筑保留了太行山区传统村落的布局与构造，石砌墙体、院落式空间既体现了地方建筑特色，也反映了抗战时期'隐蔽办公、就地抗战'的实际需求。作为安阳地区抗日政权的重要遗存，它见证了当地军民在抗战时期的斗争历程。",
            "address": "河南省安阳市殷都区磊口乡泉门村",
            "specialties": ["樱桃", "金丝皇菊", "水冶油酥烧饼"]
        },
        {
            "id": 2,
            "city": "安阳",
            "name": "扁担精神纪念馆",
            "location": "河南省林州市石板岩镇",
            "image": "https://via.placeholder.com/600x400/8b0000/ffffff?text=扁担精神纪念馆",
            "basicInfo": "扁担精神纪念馆位于河南省林州市石板岩镇(太行大峡谷腹地)，是'扁担精神'的发源地。新馆建筑面积约4600平方米，展厅面积1100平方米，设7个主题展厅，展出图片480张、实物356件。",
            "history": "1946年7月，4名共产党员以18.21元为启动资金，用庙里的供桌作柜台，创办了'石板岩供销合作社'。因当地山大沟深、无通车道路，职工只能用扁担肩挑货物，翻山越岭服务村民，形成了'一根扁担挑家业，两个肩膀担真情'的创业写照。",
            "features": "扁担精神的核心是'艰苦创业、勤俭办社、一心为民、开拓创新'。与红旗渠精神同根同源，是林州人民的精神财富之一。如今，扁担精神纪念馆已成为红色教育、廉政教育的重要载体。",
            "address": "河南省林州市石板岩镇",
            "specialties": ["大红袍花椒", "山楂", "柿饼", "土蜂蜜", "红薯粉条", "老粗布"]
        },
        {
            "id": 3,
            "city": "商丘",
            "name": "淮海战役总前委旧址",
            "location": "河南省商丘市永城市陈官庄乡",
            "image": "https://via.placeholder.com/600x400/8b0000/ffffff?text=淮海战役总前委旧址",
            "basicInfo": "淮海战役总前委旧址位于商丘市永城市陈官庄乡，是淮海战役第三阶段总前委指挥部所在地，现为全国重点文物保护单位、全国爱国主义教育示范基地。旧址占地约1.5万平方米，包括总前委会议室、机要室、电台室等历史建筑。",
            "history": "1948年12月至1949年1月，淮海战役总前委曾在此指挥作战。邓小平、刘伯承、陈毅、粟裕、谭震林等在此运筹帷幄，指挥了淮海战役的最后阶段，为解放战争的胜利作出了重大贡献。",
            "features": "旧址完整保留了战争时期的指挥所风貌，是研究淮海战役和解放战争历史的重要实物资料。馆内陈列了大量珍贵的历史文物、照片和文献，生动再现了淮海战役的壮阔场景。",
            "address": "河南省商丘市永城市陈官庄乡",
            "specialties": ["永城大枣", "柘城三樱椒", "胡辣汤", "民权葡萄酒"]
        }
    ]


@app.route('/')
def index():
    """首页"""
    return render_template('index.html')


@app.route('/api/heritage-data')
def get_heritage_data():
    """获取遗址数据的API接口"""
    data = load_all_heritage_data()
    return jsonify(data)


@app.route('/api/cities')
def get_cities():
    """获取所有城市的API接口"""
    cities = set()
    all_data = load_all_heritage_data()

    for item in all_data:
        cities.add(item["city"])

    return jsonify(list(cities))


@app.route('/static/temp_images/<filename>')
def serve_temp_image(filename):
    """提供临时图片文件的访问"""
    return send_from_directory(TEMP_IMAGE_DIR, filename)


if __name__ == '__main__':
    # 确保静态文件目录存在
    os.makedirs("static/temp_images", exist_ok=True)

    # 打印启动信息
    print("=" * 50)
    print("薪火护遗 - 红色文化遗址保护平台")
    print("=" * 50)
    print("正在启动服务器...")
    print(f"数据目录: {DATA_DIR}")
    print("访问地址: http://127.0.0.1:5000")
    print("=" * 50)

    # 运行Flask应用
    app.run(debug=True, host='127.0.0.1', port=5000)