import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Datos unificados',
    Img: require('@site/static/img/360.png').default,
    description: (
      <>
        La API de SIDIS unifica fuentes heterogéneas —bases SQL, NoSQL, APIs externas, IoT, CRMs— en un endpoint universal. 
        Centraliza la consulta, reduce la complejidad y mejora la trazabilidad en tiempo real.
      </>
    ),
  },
  {
    title: 'Motor Inteligente de Enriquecimiento',
    Img: require('@site/static/img/pantallas_sidis_crm_ai.png').default,
    description: (
      <>
       Convierte datos en conocimiento.
      Integra reglas de negocio, validaciones y modelos predictivos directamente desde la API. Cada petición puede enriquecer los datos con indicadores,
      segmentaciones o scoring inteligentes antes de ser devueltos.
      </>
    ),
  },
  {
    title: 'Capa de Activación y Automatización',
    Img: require('@site/static/img/interaction.png').default,
    description: (
      <>
        Del dato a la acción en segundos.
        Activa flujos automáticos, notificaciones o campañas desde un mismo endpoint. 
        La API se conecta con CRM, dashboards o sistemas externos para convertir resultados en decisiones y acciones concretas.
      </>
    ),
  },
];

function Feature({Svg, Img, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {Svg ? (
          <Svg className={styles.featureSvg} role="img" />
        ) : (
          <img 
            className={styles.featureSvg} 
            src={Img} 
            alt={title}
            role="img" 
          />
        )}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
